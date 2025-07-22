# Implementation Examples for Live Scoreboard API

## Authentication Service

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User';
import { redisClient } from '../cache/redisClient';

interface TokenPayload {
  userId: string;
  username: string;
  sessionId: string;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET!;
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
  private readonly SESSION_PREFIX = 'session:';

  async login(username: string, password: string) {
    const user = await User.findOne({ where: { username } });
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      throw new Error('Invalid credentials');
    }

    const sessionId = uuidv4();
    const payload: TokenPayload = { userId: user.id, username: user.username, sessionId };

    const accessToken = jwt.sign(payload, this.JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, this.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    await this.storeSession(sessionId, user.id, refreshToken);
    await user.update({ lastLoginAt: new Date() });

    return { accessToken, refreshToken, expiresIn: 3600 };
  }

  async validateToken(token: string): Promise<TokenPayload> {
    const payload = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
    const session = await redisClient.get(`${this.SESSION_PREFIX}${payload.sessionId}`);
    
    if (!session) throw new Error('Session expired');
    return payload;
  }

  async refreshToken(refreshToken: string) {
    const payload = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as TokenPayload & { type: string };
    
    if (payload.type !== 'refresh') throw new Error('Invalid token type');
    
    const sessionKey = `${this.SESSION_PREFIX}${payload.sessionId}`;
    const storedToken = await redisClient.get(sessionKey);
    
    if (storedToken !== refreshToken) throw new Error('Invalid refresh token');

    const accessToken = jwt.sign(
      { userId: payload.userId, username: payload.username, sessionId: payload.sessionId },
      this.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return { accessToken, expiresIn: 3600 };
  }

  private async storeSession(sessionId: string, userId: string, refreshToken: string) {
    await redisClient.setex(`${this.SESSION_PREFIX}${sessionId}`, 604800, refreshToken);
    await redisClient.sadd(`user_sessions:${userId}`, sessionId);
  }

  async logout(sessionId: string, userId: string) {
    await redisClient.del(`${this.SESSION_PREFIX}${sessionId}`);
    await redisClient.srem(`user_sessions:${userId}`, sessionId);
  }
}
```

## Authentication Middleware

```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

interface AuthRequest extends Request {
  user?: { userId: string; username: string; sessionId: string; };
}

const authService = new AuthService();

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = authHeader.substring(7);
    req.user = await authService.validateToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

## Score Service

```typescript
import { Transaction } from 'sequelize';
import { Score } from '../models/Score';
import { ScoreHistory } from '../models/ScoreHistory';
import { Action } from '../models/Action';
import { AntiCheatService } from './antiCheatService';
import { LeaderboardService } from './leaderboardService';
import { QueuePublisher } from '../queue/publisher';
import { redisClient } from '../cache/redisClient';
import crypto from 'crypto';

interface ScoreUpdateRequest {
  userId: string;
  actionId: string;
  scoreIncrement: number;
  timestamp: Date;
  metadata: {
    actionType: string;
    duration: number;
    checksum: string;
  };
}

export class ScoreService {
  private antiCheatService = new AntiCheatService();
  private leaderboardService = new LeaderboardService();
  private queuePublisher = new QueuePublisher();

  async updateScore(request: ScoreUpdateRequest, actionToken: string) {
    const transaction = await Score.sequelize!.transaction();

    try {
      const action = await this.validateActionToken(actionToken, request.actionId, request.userId, transaction);

      const isValid = await this.antiCheatService.validateScoreUpdate({
        userId: request.userId,
        scoreIncrement: request.scoreIncrement,
        actionType: request.metadata.actionType,
        timestamp: request.timestamp,
        checksum: request.metadata.checksum
      });

      if (!isValid) {
        await this.flagSuspiciousActivity(request.userId, request);
        throw new Error('Score update failed validation');
      }

      const currentScore = await Score.findOne({
        where: { userId: request.userId },
        transaction,
        lock: Transaction.LOCK.UPDATE
      });

      if (!currentScore) throw new Error('User score not found');

      const previousScore = currentScore.currentScore;
      const previousRank = await this.leaderboardService.getUserRank(request.userId);
      const newScore = previousScore + request.scoreIncrement;

      await currentScore.update({
        currentScore: newScore,
        lastUpdated: new Date(),
        totalActions: currentScore.totalActions + 1
      }, { transaction });

      await ScoreHistory.create({
        userId: request.userId,
        actionId: request.actionId,
        scoreChange: request.scoreIncrement,
        previousScore,
        newScore,
        timestamp: request.timestamp,
        metadata: request.metadata
      }, { transaction });

      await action.update({
        status: 'completed',
        completedAt: new Date()
      }, { transaction });

      await transaction.commit();

      await this.updateScoreCache(request.userId, newScore);
      const newRank = await this.leaderboardService.updateUserScore(request.userId, newScore);

      await this.publishScoreUpdate({
        userId: request.userId,
        username: currentScore.user.username,
        oldScore: previousScore,
        newScore,
        oldRank: previousRank,
        newRank,
        timestamp: new Date()
      });

      return { success: true, newScore, rank: newRank, previousRank };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async validateActionToken(token: string, actionId: string, userId: string, transaction: Transaction) {
    const action = await Action.findOne({
      where: { id: actionId, userId, token, status: 'pending' },
      transaction
    });

    if (!action || new Date() > action.expiresAt) {
      throw new Error('Invalid or expired action token');
    }

    return action;
  }

  private async updateScoreCache(userId: string, score: number) {
    await redisClient.setex(`user_score:${userId}`, 300, score.toString());
  }

  private async publishScoreUpdate(data: any) {
    await this.queuePublisher.publish('score.updated', data);
  }

  private async flagSuspiciousActivity(userId: string, request: ScoreUpdateRequest) {
    await redisClient.setex(
      `suspicious:${userId}`,
      86400,
      JSON.stringify({ timestamp: new Date(), request, reason: 'Failed anti-cheat validation' })
    );
  }

  async generateActionToken(userId: string, actionType: string) {
    const actionId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 300000);

    await Action.create({
      id: actionId,
      userId,
      actionType,
      status: 'pending',
      token,
      createdAt: new Date(),
      expiresAt
    });

    return { actionId, token, expiresAt };
  }
}
```

## WebSocket Service

```typescript
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { AuthService } from './authService';
import { LeaderboardService } from './leaderboardService';
import { redisClient } from '../cache/redisClient';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export class WebSocketService {
  private io: SocketIOServer;
  private authService = new AuthService();
  private leaderboardService = new LeaderboardService();
  private connectedUsers = new Map<string, Set<string>>();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: { origin: process.env.ALLOWED_ORIGINS?.split(',') || '*', credentials: true },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    this.subscribeToRedisEvents();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      socket.on('auth', async (data: { token: string }) => {
        try {
          const payload = await this.authService.validateToken(data.token);
          
          socket.userId = payload.userId;
          socket.username = payload.username;

          this.addUserConnection(payload.userId, socket.id);
          socket.join(`user:${payload.userId}`);
          socket.join('leaderboard');

          const leaderboard = await this.leaderboardService.getTop10();
          socket.emit('authenticated', { success: true, leaderboard });
        } catch {
          socket.emit('authenticated', { success: false, error: 'Authentication failed' });
          socket.disconnect();
        }
      });

      socket.on('disconnect', () => {
        if (socket.userId) {
          this.removeUserConnection(socket.userId, socket.id);
        }
      });

      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }

  private subscribeToRedisEvents() {
    const subscriber = redisClient.duplicate();
    
    subscriber.subscribe('score_updates');
    subscriber.subscribe('leaderboard_updates');

    subscriber.on('message', async (channel: string, message: string) => {
      const data = JSON.parse(message);

      switch (channel) {
        case 'score_updates':
          await this.handleScoreUpdate(data);
          break;
        case 'leaderboard_updates':
          await this.handleLeaderboardUpdate(data);
          break;
      }
    });
  }

  private async handleScoreUpdate(data: any) {
    const leaderboard = await this.leaderboardService.getTop10();

    this.io.to('leaderboard').emit('scoreUpdate', {
      type: 'scoreUpdate',
      data: { ...data, leaderboard },
      timestamp: new Date().toISOString()
    });

    this.io.to(`user:${data.userId}`).emit('personalScoreUpdate', {
      type: 'personalScoreUpdate',
      data: {
        oldScore: data.oldScore,
        newScore: data.newScore,
        oldRank: data.oldRank,
        newRank: data.newRank
      },
      timestamp: new Date().toISOString()
    });
  }

  private async handleLeaderboardUpdate(data: any) {
    this.io.to('leaderboard').emit('leaderboardUpdate', {
      type: 'leaderboardUpdate',
      data: data.leaderboard,
      timestamp: new Date().toISOString()
    });
  }

  private addUserConnection(userId: string, socketId: string) {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
  }

  private removeUserConnection(userId: string, socketId: string) {
    const connections = this.connectedUsers.get(userId);
    if (connections) {
      connections.delete(socketId);
      if (connections.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
  }

  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }
}
```

## Anti-Cheat Service

```typescript
import { redisClient } from '../cache/redisClient';
import { ScoreHistory } from '../models/ScoreHistory';
import crypto from 'crypto';

interface ValidationRequest {
  userId: string;
  scoreIncrement: number;
  actionType: string;
  timestamp: Date;
  checksum: string;
}

export class AntiCheatService {
  private config = {
    maxScorePerAction: 100,
    minTimeBetweenActions: 1000,
    maxActionsPerHour: 100,
    suspiciousPatterns: {
      rapidFireThreshold: 10,
      scoreVelocityLimit: 1000
    }
  };

  async validateScoreUpdate(request: ValidationRequest): Promise<boolean> {
    if (!this.validateChecksum(request)) return false;
    if (request.scoreIncrement > this.config.maxScorePerAction) return false;

    const lastActionTime = await this.getLastActionTime(request.userId);
    if (lastActionTime) {
      const timeDiff = request.timestamp.getTime() - lastActionTime.getTime();
      if (timeDiff < this.config.minTimeBetweenActions) return false;
    }

    const actionCount = await this.getActionCount(request.userId, 3600);
    if (actionCount >= this.config.maxActionsPerHour) return false;

    const isSuspicious = await this.detectSuspiciousPatterns(request);
    if (isSuspicious) return false;

    await this.recordAction(request);
    return true;
  }

  private validateChecksum(request: ValidationRequest): boolean {
    const expectedChecksum = crypto
      .createHash('sha256')
      .update(`${request.userId}:${request.actionType}:${request.scoreIncrement}:${process.env.CHECKSUM_SECRET}`)
      .digest('hex');

    return request.checksum === expectedChecksum;
  }

  private async getLastActionTime(userId: string): Promise<Date | null> {
    const timestamp = await redisClient.get(`last_action:${userId}`);
    return timestamp ? new Date(parseInt(timestamp)) : null;
  }

  private async getActionCount(userId: string, windowSeconds: number): Promise<number> {
    const count = await redisClient.get(`action_count:${userId}`);
    return count ? parseInt(count) : 0;
  }

  private async detectSuspiciousPatterns(request: ValidationRequest): Promise<boolean> {
    const recentActions = await this.getRecentActions(request.userId, 60);
    if (recentActions.length > this.config.suspiciousPatterns.rapidFireThreshold) {
      return true;
    }

    const scoreVelocity = await this.calculateScoreVelocity(request.userId, 3600);
    return scoreVelocity > this.config.suspiciousPatterns.scoreVelocityLimit;
  }

  private async recordAction(request: ValidationRequest) {
    const key = `last_action:${request.userId}`;
    await redisClient.setex(key, 3600, request.timestamp.getTime().toString());

    const countKey = `action_count:${request.userId}`;
    await redisClient.incr(countKey);
    await redisClient.expire(countKey, 3600);
  }

  private async getRecentActions(userId: string, windowSeconds: number) {
    const since = new Date(Date.now() - windowSeconds * 1000);
    return await ScoreHistory.findAll({
      where: {
        userId,
        timestamp: { [Op.gte]: since }
      },
      order: [['timestamp', 'DESC']]
    });
  }

  private async calculateScoreVelocity(userId: string, windowSeconds: number): Promise<number> {
    const since = new Date(Date.now() - windowSeconds * 1000);
    const result = await ScoreHistory.sum('scoreChange', {
      where: {
        userId,
        timestamp: { [Op.gte]: since }
      }
    });
    return result || 0;
  }
}
```

## Database Models

```typescript
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/connection';

export class User extends Model {
  public id!: string;
  public username!: string;
  public email!: string;
  public passwordHash!: string;
  public lastLoginAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  lastLoginAt: { type: DataTypes.DATE }
}, { sequelize, modelName: 'User' });

export class Score extends Model {
  public id!: string;
  public userId!: string;
  public currentScore!: number;
  public totalActions!: number;
  public lastUpdated!: Date;
}

Score.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, unique: true },
  currentScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalActions: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastUpdated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'Score' });

export class Action extends Model {
  public id!: string;
  public userId!: string;
  public actionType!: string;
  public status!: 'pending' | 'completed' | 'failed';
  public token!: string;
  public expiresAt!: Date;
  public completedAt?: Date;
}

Action.init({
  id: { type: DataTypes.UUID, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  actionType: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'completed', 'failed'), defaultValue: 'pending' },
  token: { type: DataTypes.STRING, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  completedAt: { type: DataTypes.DATE }
}, { sequelize, modelName: 'Action' });
```

## Cache Manager

```typescript
import { redisClient } from './redisClient';

export class CacheManager {
  async get<T>(key: string): Promise<T | null> {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl: number = 300) {
    await redisClient.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string) {
    await redisClient.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await redisClient.exists(key)) === 1;
  }

  async invalidatePattern(pattern: string) {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  }

  async getLeaderboard(): Promise<any[]> {
    const cached = await this.get('leaderboard:top10');
    if (cached) return cached;

    const leaderboard = await this.calculateLeaderboard();
    await this.set('leaderboard:top10', leaderboard, 60);
    return leaderboard;
  }

  private async calculateLeaderboard() {
    return await Score.findAll({
      include: [{ model: User, attributes: ['username'] }],
      order: [['currentScore', 'DESC']],
      limit: 10
    });
  }
}

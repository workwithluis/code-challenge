# Live Scoreboard System Flow Diagram

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile App]
    end
    
    subgraph "API Gateway"
        GATEWAY[API Gateway<br/>- Rate Limiting<br/>- Load Balancing<br/>- SSL Termination]
    end
    
    subgraph "Application Services"
        AUTH[Authentication Service<br/>- JWT Management<br/>- User Validation]
        SCORE[Score Service<br/>- Score Updates<br/>- Validation Logic]
        WS[WebSocket Service<br/>- Real-time Updates<br/>- Connection Management]
        LEADER[Leaderboard Service<br/>- Top 10 Calculation<br/>- Ranking Logic]
    end
    
    subgraph "Data Layer"
        REDIS[(Redis Cache<br/>- Top 10 Scores<br/>- Session Data<br/>- Pub/Sub)]
        DB[(PostgreSQL<br/>- User Data<br/>- Score History<br/>- Action Logs)]
        MQ[Message Queue<br/>- Event Distribution<br/>- Async Processing]
    end
    
    WEB --> GATEWAY
    MOBILE --> GATEWAY
    GATEWAY --> AUTH
    GATEWAY --> SCORE
    GATEWAY --> WS
    GATEWAY --> LEADER
    
    AUTH --> DB
    AUTH --> REDIS
    
    SCORE --> DB
    SCORE --> REDIS
    SCORE --> MQ
    
    WS --> REDIS
    WS --> MQ
    
    LEADER --> REDIS
    LEADER --> DB
    
    MQ --> WS
```

## Score Update Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant Gateway
    participant Auth
    participant Score
    participant Redis
    participant DB
    participant MQ
    participant WebSocket
    participant OtherClients
    
    User->>Client: Complete Action
    Client->>Gateway: POST /api/v1/scores/update<br/>(JWT + Action Token)
    Gateway->>Gateway: Rate Limit Check
    Gateway->>Auth: Validate JWT Token
    Auth->>Redis: Check Token Validity
    Redis-->>Auth: Token Valid
    Auth-->>Gateway: User Authenticated
    
    Gateway->>Score: Process Score Update
    Score->>Score: Validate Action Token
    Score->>Score: Check Anti-Cheat Rules
    Score->>DB: Begin Transaction
    
    Score->>DB: Update User Score
    Score->>DB: Log Score History
    Score->>DB: Mark Action Complete
    Score->>DB: Commit Transaction
    
    Score->>Redis: Update Cached Score
    Score->>Redis: Recalculate Top 10
    Score->>MQ: Publish Score Event
    
    Score-->>Gateway: Success Response
    Gateway-->>Client: Score Updated
    
    MQ->>WebSocket: Score Update Event
    WebSocket->>Redis: Get Updated Leaderboard
    Redis-->>WebSocket: Top 10 Data
    WebSocket->>OtherClients: Broadcast Update
    
    Client->>Client: Update UI
    OtherClients->>OtherClients: Update Leaderboard
```

## WebSocket Connection Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant WebSocket
    participant Auth
    participant Redis
    
    Client->>Gateway: WSS Connection Request
    Gateway->>WebSocket: Route to WS Service
    WebSocket->>Client: Connection Established
    
    Client->>WebSocket: Send Auth Message<br/>{type: "auth", token: "JWT"}
    WebSocket->>Auth: Validate Token
    Auth->>Redis: Check Session
    Redis-->>Auth: Valid Session
    Auth-->>WebSocket: User Authenticated
    
    WebSocket->>Redis: Subscribe to Score Events
    WebSocket->>Redis: Register Connection
    WebSocket->>Client: Auth Success
    
    loop Heartbeat
        WebSocket->>Client: Ping
        Client->>WebSocket: Pong
    end
    
    Redis->>WebSocket: Score Update Event
    WebSocket->>Client: Broadcast Update
```

## Authentication Flow

```mermaid
flowchart LR
    A[User Login] --> B{Valid Credentials?}
    B -->|Yes| C[Generate JWT]
    B -->|No| D[Return Error]
    C --> E[Generate Refresh Token]
    E --> F[Store Session in Redis]
    F --> G[Return Tokens]
    
    H[API Request] --> I{Has JWT?}
    I -->|No| D
    I -->|Yes| J{Token Valid?}
    J -->|No| K{Has Refresh Token?}
    J -->|Yes| L[Process Request]
    K -->|No| D
    K -->|Yes| M[Refresh JWT]
    M --> L
```

## Anti-Cheat Validation Flow

```mermaid
flowchart TD
    A[Score Update Request] --> B[Check Action Token]
    B --> C{Token Valid?}
    C -->|No| D[Reject: Invalid Token]
    C -->|Yes| E{Token Used?}
    E -->|Yes| D
    E -->|No| F[Check Score Increment]
    
    F --> G{Within Limits?}
    G -->|No| H[Flag for Review]
    G -->|Yes| I[Check Time Delta]
    
    I --> J{Too Fast?}
    J -->|Yes| H
    J -->|No| K[Check Pattern]
    
    K --> L{Suspicious?}
    L -->|Yes| H
    L -->|No| M[Allow Update]
    
    H --> N[Add to Review Queue]
    N --> O[Temporary Score Hold]
    O --> P[Manual Review]
    P --> Q{Legitimate?}
    Q -->|Yes| M
    Q -->|No| R[Ban User]
```

## Cache Strategy Flow

```mermaid
flowchart LR
    subgraph "Read Path"
        A[Get Top 10 Request] --> B{In Cache?}
        B -->|Yes| C[Return Cached Data]
        B -->|No| D[Query Database]
        D --> E[Update Cache]
        E --> C
    end
    
    subgraph "Write Path"
        F[Score Update] --> G[Update Database]
        G --> H[Invalidate Cache]
        H --> I[Recalculate Top 10]
        I --> J[Update Cache]
        J --> K[Publish Event]
    end
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Internet"
        USERS[Users]
    end
    
    subgraph "CDN Layer"
        CF[CloudFlare<br/>DDoS Protection]
    end
    
    subgraph "Load Balancer"
        ALB[Application Load Balancer]
        NLB[Network Load Balancer]
    end
    
    subgraph "Application Tier"
        subgraph "API Servers"
            API1[API Server 1]
            API2[API Server 2]
            API3[API Server N]
        end
        
        subgraph "WebSocket Servers"
            WS1[WS Server 1]
            WS2[WS Server 2]
            WS3[WS Server 3]
        end
    end
    
    subgraph "Data Tier"
        subgraph "Cache Cluster"
            REDIS1[Redis Primary]
            REDIS2[Redis Replica 1]
            REDIS3[Redis Replica 2]
        end
        
        subgraph "Database Cluster"
            DB1[PostgreSQL Primary]
            DB2[PostgreSQL Replica 1]
            DB3[PostgreSQL Replica 2]
        end
        
        MQ1[Message Queue]
    end
    
    USERS --> CF
    CF --> ALB
    CF --> NLB
    ALB --> API1
    ALB --> API2
    ALB --> API3
    NLB --> WS1
    NLB --> WS2
    NLB --> WS3
    
    API1 --> REDIS1
    API2 --> REDIS1
    API3 --> REDIS1
    
    API1 --> DB1
    API2 --> DB1
    API3 --> DB1
    
    WS1 --> REDIS1
    WS2 --> REDIS1
    WS3 --> REDIS1
    
    API1 --> MQ1
    API2 --> MQ1
    API3 --> MQ1
    
    MQ1 --> WS1
    MQ1 --> WS2
    MQ1 --> WS3
    
    REDIS1 --> REDIS2
    REDIS1 --> REDIS3
    DB1 --> DB2
    DB1 --> DB3
```

## Error Handling Flow

```mermaid
flowchart TD
    A[API Request] --> B{Request Valid?}
    B -->|No| C[400 Bad Request]
    B -->|Yes| D{Authenticated?}
    D -->|No| E[401 Unauthorized]
    D -->|Yes| F{Authorized?}
    F -->|No| G[403 Forbidden]
    F -->|Yes| H[Process Request]
    
    H --> I{Success?}
    I -->|Yes| J[200 OK]
    I -->|No| K{Error Type?}
    
    K -->|Not Found| L[404 Not Found]
    K -->|Conflict| M[409 Conflict]
    K -->|Rate Limit| N[429 Too Many Requests]
    K -->|Server Error| O[500 Internal Error]
    
    O --> P[Log Error]
    P --> Q[Alert Team]
    Q --> R[Return Generic Error]
```

## State Management Flow

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    Disconnected --> Connecting: User Opens App
    Connecting --> Connected: WebSocket Established
    Connecting --> Disconnected: Connection Failed
    
    Connected --> Authenticated: Send Auth Token
    Connected --> Disconnected: Auth Timeout
    
    Authenticated --> Active: Auth Success
    Authenticated --> Disconnected: Auth Failed
    
    Active --> Active: Receive Updates
    Active --> Active: Send Score Update
    Active --> Inactive: No Activity (5 min)
    Active --> Disconnected: Connection Lost
    
    Inactive --> Active: User Activity
    Inactive --> Disconnected: Timeout (15 min)
    
    Disconnected --> Connecting: Retry Connection
    Disconnected --> [*]: Close App
```

## Data Flow Summary

1. **User Action → Score Update**
   - User completes action in client
   - Client sends authenticated request to API
   - API validates request and updates database
   - Cache is updated with new scores
   - Event is published to message queue

2. **Score Update → Live Updates**
   - Message queue delivers event to WebSocket service
   - WebSocket service retrieves updated leaderboard
   - Updates are broadcast to all connected clients
   - Clients update their UI in real-time

3. **Security Checkpoints**
   - JWT validation at API Gateway
   - Action token validation in Score Service
   - Anti-cheat rules enforcement
   - Rate limiting at multiple levels
   - Audit logging for all actions

4. **Performance Optimizations**
   - Redis cache for frequent queries
   - Database read replicas for scalability
   - Message queue for asynchronous processing
   - WebSocket connection pooling
   - CDN for static assets

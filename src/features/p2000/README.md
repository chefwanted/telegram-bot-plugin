# P2000 Feature

Real-time Dutch emergency services (112) notifications for the Utrecht region.

## 📋 Features
- ✅ **Real-time notifications** - Scrapes P2000.nl RSS feed every 30 seconds
## 
- ✅ **Region filtering** - Filters for Utrecht province municipalities
- ✅ **Service filtering** - Filter by Brandweer, Ambulance, Politie, Kustwacht, GHOR
- ✅ **Priority detection** - Recognizes A1, A2, B1, B2, GRIP, and priority keywords
- ✅ **Smart matching** - Word boundary detection to prevent false positives
- ✅ **Subscriptions** - Users can subscribe to push notifications
- ✅ **Configurable** - Polling interval, cache size, and limits are configurable

## 🏗️ Architecture

```
p2000/
├── types.ts          # TypeScript interfaces
├── filters.ts        # Region & location filters
├── scraper.ts        # RSS feed scraper
├── subscription.ts   # Subscription management
├── notifier.ts       # Push notification service
├── commands.ts       # Telegram bot commands
└── index.ts          # Barrel exports
```

## 🚀 Usage

### Basic Commands

```typescript
// Get recent messages
/p2000

// Filter by service
/p2000 brandweer
/p2000 ambulance
/p2000 politie

// Filter by region
/p2000 Utrecht
/p2000 Amersfoort

// Subscribe to notifications
/p2000 subscribe on
/p2000 subscribe off
/p2000 subscribe status

// Get help
/p2000 help
```

### Programmatic Usage

```typescript
import {
  createP2000Scraper,
  createSubscriptionManager,
  createP2000Notifier,
} from './features/p2000';

// Create scraper
const scraper = createP2000Scraper({
  cacheTtl: 5 * 60 * 1000,
  maxCacheSize: 1000,
});

// Fetch messages
const messages = await scraper.fetchMessages({ limit: 10 });

// Subscribe a user
const subManager = createSubscriptionManager();
await subManager.subscribe('123456789', ['Utrecht'], [
  { service: 'brandweer', priority: 2 }
]);

// Start notification service
const notifier = createP2000Notifier({
  pollInterval: 30000,
  maxNotificationsPerChat: 5,
});
notifier.start(api);
```

## 🔧 Configuration

### Feed source (belangrijk)

Sommige P2000 bronnen (o.a. `p2000.nl`) kunnen in bepaalde omgevingen **HTML teruggeven i.p.v. RSS/XML** (of TLS/cert problemen geven). Daarom kun je de feedbron instellen via environment variables.

```bash
# Primary feed URL (default: https://feeds.feedburner.com/p2000)
P2000_FEED_URL=https://feeds.feedburner.com/p2000

# Optional fallback feed URL (default: https://www.p2000.nl/rss)
P2000_FALLBACK_FEED_URL=https://www.p2000.nl/rss

# Optional (NIET aangeraden): accepteer ongeldige TLS certificaten
P2000_ALLOW_INSECURE_TLS=1

# Optional: Utrecht-filter standaard aanzetten (alleen gebruiken als je feed Utrecht-locaties bevat)
P2000_FILTER_UTRECHT_BY_DEFAULT=1
```

Als je `p2000.nl` gebruikt en je ziet HTML responses, laat de default Feedburner aan staan of kies een andere RSS provider.

### Scraper Configuration

```typescript
interface P2000ScraperConfig {
  cacheTtl?: number;          // Cache TTL in ms (default: 5 min)
  maxCacheSize?: number;      // Max message IDs to track (default: 1000)
  requestTimeout?: number;    // Request timeout in ms (default: 15s)
  userAgent?: string;         // User agent for requests
  feedUrl?: string;           // P2000 RSS feed URL
}
```

### Notifier Configuration

```typescript
interface P2000NotifierConfig {
  pollInterval?: number;              // Polling interval in ms (default: 30s)
  maxMessagesPerPoll?: number;        // Max messages per poll (default: 50)
  maxNotificationsPerChat?: number;   // Max notifications per chat (default: 5)
  enabled?: boolean;                  // Enable/disable globally
}
```

## 🧪 Testing

```typescript
import { setScraper, setSubManager } from './commands';

// Inject mock scraper for testing
const mockScraper = createP2000Scraper();
setScraper(mockScraper);

// Inject mock subscription manager
const mockSubManager = createSubscriptionManager();
setSubManager(mockSubManager);
```

## 📊 Data Flow

```
P2000.nl RSS Feed
       ↓
  P2000Scraper (fetch & parse)
       ↓
  Cache & Deduplicate
       ↓
  Filter by Region
       ↓
  P2000Notifier (poll new messages)
       ↓
  Check Subscriptions
       ↓
  Send Telegram Notifications
```

## 🗺️ Supported Regions

### Municipalities
Utrecht, Amersfoort, Zeist, Nieuwegein, Veenendaal, IJsselstein, Houten, Soest, Baarn, Bunschoten, De Bilt, De Ronde Venen, Eemnes, Lopik, Montfoort, Oudewater, Renswoude, Rhenen, Stichtse Vecht, Utrechtse Heuvelrug, Vianen, Wijk bij Duurstede, Woerden, Woudenberg

### Utrecht City Neighborhoods
Leidsche Rijn, Overvecht, Lombok, Oog in Al, Kanaleneiland, Lunetten, Zuilen, Ondiep, Wittevrouwen, Vleuten, De Meern, etc.

## 🔐 Priority Levels

| Priority | Description |
|----------|-------------|
| 1        | Highest (A1, GRIP 1, Reanimatie, MMT) |
| 2        | High (A2) |
| 11-12    | Lower (B1, B2) |
| 5        | Default (unknown) |

## 📝 Message Format

```
🚒 BRANDWEER | Prio 1

Brand woning, Maliebaan 50 Utrecht

📍 Utrecht | 🕐 14:32
```

## ⚙️ Initialization

The notifier needs to be started when your bot starts:

```typescript
import { getP2000Notifier } from './features/p2000';
import type { ApiMethods } from './api';

export function startBot(api: ApiMethods) {
  // Start P2000 notification service
  const notifier = getP2000Notifier();
  notifier.start(api);
  
  console.log('✅ P2000 notifier started');
}
```

## 🐛 Debug

Enable debug logging:

```typescript
import { createLogger } from './utils/logger';

const logger = createLogger({ prefix: 'P2000', level: 'debug' });
```

## 📈 Future Improvements

- [ ] PostgreSQL storage backend for subscriptions
- [ ] Advanced filter UI with inline keyboards
- [ ] Map integration with coordinates
- [ ] Historical message search
- [ ] Multi-region support (beyond Utrecht)
- [ ] Webhook support instead of polling
- [ ] Message deduplication across sources
- [ ] Analytics & usage statistics

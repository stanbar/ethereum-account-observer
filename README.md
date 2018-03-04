# ethereum-account-observer
Observe **ethereum** network via geth client through WebSocket subscription.

## How to use

`docker-compose up`

Starts two services:
- geth  - ethereum p2p client in light mode (doesn't store blockchain)
- ethWatcher - nodejs app that is observing changes on account address

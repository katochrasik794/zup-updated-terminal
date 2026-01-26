# Build Scripts

## build-trading-bundles.cjs

This script automatically builds the TradingView bundles required by the application:

- `datafeeds/udf/dist/bundle.js` - UDF compatible datafeed
- `broker-sample/dist/bundle.js` - Broker sample implementation  
- `custom-dialogs/dist/bundle.js` - Custom dialogs bundle
- `custom-dialogs/dist/bundle.css` - Custom dialogs styles

### How it works

1. Builds each bundle from source code in `src/trading_platform-master/`
2. Copies the built bundles to the `public/` folder where they can be served
3. Skips npm install if dependencies already exist (for faster subsequent builds)

### When it runs

The script runs automatically:
- After `npm install` (via `postinstall` hook)
- Manually via `npm run build:trading-bundles`

### Troubleshooting

If bundles are missing after cloning:
1. Run `npm install` - this will automatically build the bundles
2. Or manually run `npm run build:trading-bundles`

The bundles must be in the `public/` folder to be accessible by the web server.

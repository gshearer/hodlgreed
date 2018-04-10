var config = {};
config.debug = true; // for additional logging / debugging

config.watch = {
  exchange: 'binance',
  currency: 'USDT',
  asset: 'ETH',
}

config.hodlgreed = {
  buy_at_or_below: 0.0000001,
  last_buy_price: 0,
  max_nobuy_candles: 60,
  adjust: 1.2,
  stoploss: 0,
  greed: 2,
  sma: { interval: 60 },
  irc: {
    enabled: true,
    server: 'irc.server.com',
    port: 6667,
    nickname: 'bot1-usdt-eth',
    userName: 'hodlgreed',
    realName: 'Binance USDT vs ETH',
    owner: 'me',
    channels: [ '#whatever' ],
    secure: false,
    selfSigned: false,
    certExpired: false,
    autoRejoin: true,
  },
}

config.trader = {
  enabled: false,
  key: '',
  secret: '',
  username: '',
  passphrase: '',
  orderUpdateDelay: 1,
}

config.tradingAdvisor = {
  enabled: true,
  method: 'hodlgreed',
  candleSize: 1,
  historySize: 0,
}

config.paperTrader = {
  enabled: true,
  reportInCurrency: true,
  simulationBalance: {
    asset: 0,
    currency: 10,
  },
  feeMaker: 0.15,
  feeTaker: 0.25,
  feeUsing: 'maker',
  slippage: 0.05,
}

config.performanceAnalyzer = {
  enabled: true,
  riskFreeReturn: 5
}

config.adviceLogger = {
  enabled: true,
  muteSoft: false 
}

config['I understand that Gekko only automates MY OWN trading strategies'] = true;

module.exports = config;

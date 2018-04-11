
// ------------------------------------------------------------------------ \\
//                          HODL & GREED Strategy                           \\
//                        Written by George Shearer                         \\
//                         doc at-sign drow dot org                         \\
// ------------------------------------------------------------------------ \\

// HUGE Thank you to Mike van Rossum the original author of Gekko.
//
// Also would like to thank all Gekko strategy authors who publish their code.
//
// If you find this script useful, please consider donating :)
//
// I accept Chipotle gift cards, Lambos, and of course Cryptos!
//
// BTC: 1EdzJHrtQnpjWmRqC93Gq8b6gEi5QgahVk
// LTC: LeoVNreMB64gpQcch12RL5xmz263CFRXZb
// ETH: 0x4087ac736000594d624d25ed0d3abf5b465a7525
// XMR: 44oTLFQGPdP8ktEHDB3Vcg5otvZFn3w4c3bvEeGutP2916aPcZEMJ3v1YYvnGqbqb1LoiRXCKg7d2aNQs2WcLgezT5Pf7uT
//
// SHOUT OUT to CCG! This is Sparta!

// LICENSE
// -------
//
// The MIT License (MIT)
//
// Copyright (c) 2018 George Shearer
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// -------------------------------------------------------------------------- \\

var log = require('../core/log.js');
var config = require('../core/util.js').getConfig();
var irc = require('irc');

var settings = config.hodlgreed;

// Globals
var digits = 8, sma = 0, trend = 0, cc = 0, cc_nobuys = 0, hp = 0;
var buy_num = 0, sell_num = 0, profit = 0, last_profit = 0, buy_price = settings.last_buy_price, sell_price = 0;
var bid = settings.buy_at_or_below;
var adjust = settings.adjust;
var greed = settings.greed;
var color = 'unknown';
var trend_type = 'unknown';
var chistory = [];
chistory.length = settings.sma.interval;
var last_action = (buy_price) ? 'buy' : 'sell';
var version = '2018041101';
var last_candle = 'none';
var motd = 'none';
var hodl = {};
var force_trade = 'none';
var hodl_mode = false;
var getout = false;

hodl.log = function(candle) { }

hodl.notify = function(msg)
{
  log.debug(msg);
  if(settings.irc.enabled == true)
    for(var x = 0; x < settings.irc.channels.length; x++)
      this.ircbot.say(settings.irc.channels[x], msg);
}

hodl.ircmsg = function(from, to, message)
{
  var replyto = (to.match(/^[#&]/)) ? to : from;

  log.debug('[IRC] from: ' + from + ' to: ' + to + ' msg: ' + message);
  if(from === settings.irc.owner)
  {
    var args = message.split(/\s+/);

    switch(args[0])
    {
      case ';;help':
        this.ircbot.say(replyto, 'commands: status, set, buy, sell, cancel, candle');
        break;
      case ';;status':
        this.ircbot.say(replyto, 'buyat: ' + bid.toFixed(digits) + ' last_buy: ' + buy_price + ' (' + profit.toFixed(2) + '%) last_sell: ' + sell_price + ' (' + last_profit.toFixed(2) + '%) nobuys: ' + cc_nobuys + ' adjust: ' + adjust + ' stoploss: ' + settings.stoploss + ' greed: ' + greed + ' trading-disabled: ' + hodl_mode + ' getout: ' + getout);
        break;
      case ';;buy':
        this.ircbot.say(replyto, 'Setting buy condition for candle #' + (cc+1));
        force_trade = 'buy';
        break;
      case ';;sell':
        this.ircbot.say(replyto, 'Setting sell condition for candle #' + (cc+1));
        force_trade = 'sell';
        break;
      case ';;cancel':
        this.ircbot.say(replyto, 'Canceling forced trade condition.');
        force_trade = 'none';
        break;
      case ';;candle':
        this.ircbot.say(replyto, last_candle);
        break;
      case ';;set':
        if(args.length == 3)
        {
          switch(args[1])
          {
            case 'greed':
              greed = parseFloat(args[2]);
              this.ircbot.say(replyto, 'greed set to ' + greed);
              break;
            case 'buyat':
              bid = parseFloat(args[2]);
              cc_nobuys = 0;
              this.ircbot.say(replyto, 'buy_at_or_below set to ' + bid + ' -- nobuys counter reset to 0.');
              break;
            case 'adjust':
              adjust = parseFloat(args[2]);
              this.ircbot.say(replyto, 'adjust set to ' + adjust);
              break;
            case 'stoploss':
              stoploss = parseFloat(args[2]);
              this.ircbot.say(replyto, 'stoploss set to ' + stoploss);
              break;
            case 'nobuys':
              nobuys = parseFloat(args[2]);
              this.ircbot.say(replyto, 'max_nobuy_candles set to ' + nobuys);
              break;
            case 'hodl':
              if(args[2] == 'on' || args[2] == 'true')
              {
                hodl_mode = true;
                this.ircbot.say(replyto, 'Trading suspended')
              }
              else
              {
                hodl_mode = false;
                this.ircbot.say(replyto, 'Trading enabled');
              }
              break;
            case 'getout':
              if(args[2] == 'on' || args[2] == 'true')
              {
                getout = true;
                this.ircbot.say(replyto, 'Trading will suspend after next sell');
              }
              else
              {
                getout = false;
                this.ircbot.say(replyto, 'Trading will not suspend after next sell');
              }
              break;
            case 'buyprice':
              buy_price = parseFloat(args[2]);
              this.ircbot.say(replyto, 'buy_price set to ' + buy_price + ' - next advice will be sell.');
              last_action = 'buy';
              break;
            default:
              this.ircbot.say(replyto, 'Unsupported setting');
              break;
          }
        }
        else
          this.ircbot.say(replyto,'usage: set <greed || buyat || adjust || stoploss || nobuys || getout>');
        break;
    }
  }
}

hodl.init = function()
{
  this.name = 'HODL & Greed';
  this.requiredHistory = 0;

  if(settings.irc.enabled == true)
  {
    this.ircbot = new irc.Client(settings.irc.server, settings.irc.nickname, settings.irc);
    this.ircbot.addListener('error', log.debug);
    this.ircbot.addListener('message', this.ircmsg);
  }

  if(settings.sma.interval < 1)
    throw new Error('[hodlgreed] You must include SMA interval in settings.');

  if(settings.sma.interval < 60)
    log.debug('[hodlgreed] Your SMA period is very shallow. Consider increasing it.');

  motd = this.name + ' version ' + version + ' has been initialized! Mamma needs a new pair of shoes!';
}

hodl.check = function(candle)
{
  var x, y, diff, adviced = false;

  color = (candle.close > candle.open) ? 'green' : (candle.open > candle.close) ? 'red' : 'gray';

  chistory[hp] = {
    open: candle.open,
    close: candle.close,
    volume: candle.volume,
    high: candle.high,
    low: candle.low,
    trades: candle.trades,
    num: cc,
  };

  hp = (hp == settings.sma.interval - 1) ? 0 : hp + 1;

  if(++cc == 1)
    this.notify(motd);
  else if(cc < 2)
  {
    this.advice()
    return;
  }

  // Calculate SMA
  if(cc >= settings.sma.interval)
  {
    var sum  = 0;
    for(x = 0, y = hp; x < settings.sma.interval; x++)
    {
      sum += chistory[y].close;
      y = (y == settings.sma.interval - 1) ? 0 : y + 1;
    }
    sma = sum / settings.sma.interval;
  }

  profit = (buy_price) ? (candle.close - buy_price) / buy_price * 100 : 0;
  trend = (trend_type == color) ? trend + 1 : 1;
  trend_type = color;
  diff = candle.close - bid;

  last_candle = '#' + cc + ' ' + color + ' (' + trend + ') close: ' + candle.close.toFixed(digits) + ' bid: ' + bid.toFixed(digits) + ' diff: ' + diff.toFixed(digits) + ' sma: ' + sma.toFixed(digits) + ' nobuys: ' + cc_nobuys + ' prof: ' + profit.toFixed(2) + ' greed: ' + greed;
  log.debug(last_candle);

  // Should we offer advice?
  if(hodl_mode == false)
  {

    if(force_trade == 'buy')
    {
      last_action = 'buy';
      cc_nobuys = 0;
      last_profit = sell_price = 0;
      adviced = true;
      buy_price = candle.close;
      buy_num++;
      force_trade = 'none';
      this.notify('[[ BUY #' + buy_num + ' ]] price: ' + candle.close.toFixed(digits));
      this.advice('long');
    }
    else if(force_trade == 'sell')
    {
      sell_num++;
      sell_price = candle.close;
      buy_price = 0;
      adviced = true;
      last_action = 'sell';
      cc_nobuys = 0;
      last_profit = profit;
      force_trade = 'none';
      if(getout == true)
      {
        hodl_mode == true;
        this.notify('[[[ Trading suspended due to user asking us to GET OUT :) ]]]');
      }
      this.notify('[[ SELL #' + sell_num + ' ]] price: ' + candle.close.toFixed(digits) + ' profit: ' + profit.toFixed(2));
      this.advice('short');
    }

    // Should we buy?
    if(last_action == 'sell' && adviced == false)
    {
      cc_nobuys++;

      // Do we need to adjust our bid price first?
      if(cc >= settings.sma.interval && adjust)
      {
        var newbid = sma - (sma * (adjust / 100));

        // Provide minimal price protection with SMA
        if(bid > sma && newbid < sma)
        {
          this.notify(' [[[ Adjusted buy_at_or_below from ' + bid + ' to ' + newbid + ' as it was higher than SMA ]]]');
          bid = newbid;
          cc_nobuys = 0;
        }

        // Max no buy candles?
        else if(cc_nobuys >= nobuys && candle.close > bid && sma != 0)
        {
          this.notify(' [[[ Adjusted buy_at_or_below from ' + bid + ' to ' + newbid + ' due to max_nobuy_candles ]]]');
          bid = newbid;
          cc_nobuys = 0;
        }
      }

      if(candle.close <= bid)
      {
        buy_num++;
        buy_price = candle.close;
        last_profit = sell_price = 0;
        cc_nobuys = 0;
        last_action = 'buy';
        adviced = true;
        this.notify('[[ BUY #' + buy_num + ' ]] price: ' + candle.close.toFixed(digits));
        this.advice('long');
      }
    }

    // Should we sell?
    if(last_action == 'buy' && adviced == false && (profit >= greed || (settings.stoploss > 0 && profit < 0 && (profit * -1) >= settings.stoploss)))
    {
      sell_num++;
      sell_price = candle.close;
      buy_price = 0;
      adviced = true;
      last_action = 'sell';
      cc_nobuys = 0;
      last_profit = profit;
      this.notify('[[ SELL #' + sell_num + ' ]] price: ' + candle.close.toFixed(digits) + ' profit: ' + profit.toFixed(2));
      this.advice('short');

      if(profit < 0)
      {
        hodl_mode = true;
        this.notify('[[ STOPLOSS ENGAGED -- Trading disabled. ]]');
      }
      else if(getout == true)
      {
        hodl_mode == true;
        this.notify('[[[ Trading suspended due to user asking us to GET OUT :) ]]]');
      }
    }


    // No advice to give? :(
    if(adviced == false)
      this.advice();
  }
}

module.exports = hodl;

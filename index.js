const {Builder, By, Key, until, Capability, Capabilities } = require('selenium-webdriver');
const { Options } = require('selenium-webdriver/chrome');
const promise = require('selenium-webdriver').promise;
const readline = require('readline');
const events = require('events');
const emitter = new events.EventEmitter();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


const accountMap = {
  0: {
    username: '账号1',
    password: '密码1'
  },
  1: {
    username: '账号2',
    password: '密码2'
  }
};

const browsers = new Array(Object.keys(accountMap).length).fill('chrome');
let drivers = [];

function initDriver() {
  return browsers.map(async function(browser) {
    return await new Builder().forBrowser(browser).build();
  });
}

async function register(driver, i) {
  // await driver.manage().window().maximize();

  await driver.get('http://yourtargetsite.com');
  const capability = await driver.getCapabilities();
  const browser = capability.getBrowserName();

  const authenticateEle = await driver.wait(until.elementLocated(By.className('authenticate')), 1000);

  const actions = driver.actions({bridge: true});
  await actions.move({origin: authenticateEle}).perform();
  

  const usernameInput = await driver.findElement(By.css('input[name="loginUsername"]'));
  await usernameInput.sendKeys(accountMap[i].username);
  

  const passwordInput = await driver.findElement(By.css('input[name="loginPassword"]'));
  await passwordInput.sendKeys(accountMap[i].password);
  rl.write('go');
}

async function start () {
  Promise.all(initDriver()).then(((res) => {
    drivers = res;
    drivers.forEach(async (driver, i) => {
      await register(driver, i);
    });
  }));
}

emitter.on('go', function(drivers) {
  drivers.forEach(async (driver) => {
    await driver.executeAsyncScript(function() {
      const cb = arguments[arguments.length - 1];
      $('input[name="loginPassword"]').closest('.form-group').next().find('button').click();
      cb($('input[name="loginPassword"]').closest('.form-group').next().find('button').text());
    }).then((res) => {
      console.log('go submit', res);
    }).catch(() => {
      console.log('something going wrong in submit button');
    });

    const caipiaoEle = await driver.findElement(async (driver) => {
      const gameElements = driver.findElement(By.className('header_menu_nav'))
                                 .findElements(By.tagName('li'));

      return promise.filter(gameElements, async (item) => {
        const text = await item.getText();
        return text.trim().includes('彩票');
      });
    });

    const actions = driver.actions({bridge: true});
    await actions.move({origin: caipiaoEle}).perform();

    await driver.executeAsyncScript(function() {
      const cb = arguments[arguments.length - 1];
      $('.kenoHeaderDrop').find('li').first().find('a > div').click();
      cb();
    }).then(() => {
    }).catch(() => {
      console.log('something going wrong in  kenoHeaderDrop click');
    })

    const currentWindow = await driver.getWindowHandle();

    await driver.sleep(1000);

    const allWindows = await driver.getAllWindowHandles();

    allWindows.splice(allWindows.indexOf(currentWindow), 1);
    await driver.switchTo().window(allWindows[0]);

    await driver.executeAsyncScript(function() {
      const cb = arguments[arguments.length - 1];
      $('.ctd.ftd').first().click();
      cb();
    }).then(() => {
    }).catch(() => {
      console.log('something going wrong in ctd.ftdk');
    });

    console.log('load success');
    const progressEle = await driver.findElement(By.css('.jCProgress .percent'));
    let progressText = await progressEle.getText();

    while(progressText.trim() != 100) {
      await driver.sleep(1000);
      progressText = await progressEle.getText();
    }

    console.log('can play');

    // 刷新窗口 driver.navigate().refresh();

  });
});

const marketElementMap = {
  '90': 'mk_9',
  '60': 'mk_8',
  '45': 'mk_10'
};

emitter.on('doing', function(drivers, market, type, amount) {
  if ([45, 60, 90].indexOf(+market) === -1) return;
  if (amount % 5 !== 0) return;

  drivers.forEach(async (driver) => {
    await driver.executeAsyncScript(function() {
      const cb = arguments[arguments.length - 1];
      const amount = arguments[0];
      const marketElementMap = arguments[1];
      const market = arguments[2];
      const type = arguments[3];
      
      const times = amount / 5;
      for (let index = 0; index < times; index++) {
        if (type == 'b') {
          $(`#${marketElementMap[market]} .btnDiv1 .btn_ou_o`).click();          
        } else if (type == 's') {
          $(`#${marketElementMap[market]} .btnDiv1 .btn_ou_u`).click();
        }
      }

      $(`#${marketElementMap[market]} .betsBtnDiv .betsBtnOk`).click();

      cb();
    }, amount, marketElementMap, market, type).then(() => {
      console.log('doing success');
    });
  });
});

start();

rl.on("line", function(line) {
  switch (line.trim()) {
    case 'start':
      // start();
      break;
    case 'end':
      rl.close();
      break;
    case 'go': 
      emitter.emit('go', drivers);
    default:
      const [market, type, amount] = line.split(',');
      emitter.emit('doing', drivers, market, type, +amount);
      break;
  }
});

rl.on('close', function() {
  console.log('ready close');
  drivers.forEach(async (driver) => {
    await driver.quit();
  });
  process.exit(0);
});
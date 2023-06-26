const puppeteer = require('puppeteer-extra');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const checkUpdate = require('check-update-github');
const pkg = require('./package.json');
const path = require('path');
const fs = require('fs');
puppeteer.use(AdblockerPlugin());

const opt = JSON.parse(fs.readFileSync('./option.json', 'utf8'));
const time = new Date();
const dateStr = `${time.getFullYear()-1911}${('0'+(time.getMonth()+1)).slice(-2)}${('0'+(time.getDate()+1)).slice(-2)}`;
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
    
//nexe -t windows-x64-12.15.0
//pkg index.js -t node14-win-x64 --public
checkUpdate({
    name: pkg.name,
    currentVersion: pkg.version,
    user: 'micr0dust',
    branch: 'main'
}, function(err, latestVersion, defaultMessage) {
    if (!err) {
        if (latestVersion != pkg.version) {
            console.log("\x1b[44m");
            console.log("\x1b[0m");
            console.log("\x1b[44m  \x1b[0m");
            console.log(`\x1b[44m  \x1b[0m     \x1b[33m發現新版本！ \x1b[32m(${latestVersion})`);
            console.log("\x1b[44m  \x1b[0m     \x1b[0mhttps://github.com/micr0dust/mvdis-auto-signup");
            console.log("\x1b[44m  \x1b[0m\n\x1b[44m");
            console.log("\x1b[0m");
            return;
        } else if (latestVersion == pkg.version) {
            console.log("\x1b[42m");
            console.log("\x1b[0m");
            console.log("\x1b[42m  \x1b[0m");
            console.log(`\x1b[42m  \x1b[0m     \x1b[33m已經是最新版本！ \x1b[32m(${latestVersion})`);
            console.log("\x1b[42m  \x1b[0m     \x1b[0mhttps://github.com/micr0dust/mvdis-auto-signup");
            console.log("\x1b[42m  \x1b[0m\n\x1b[42m");
            console.log("\x1b[0m");
        }
    } else {
        console.log("\x1b[41m");
        console.log("\x1b[0m");
        console.log("\x1b[41m  \x1b[0m");
        console.log(`\x1b[41m  \x1b[0m     \x1b[33m版本偵測發生錯誤，請自行檢查當前版本是否為最新`);
        console.log("\x1b[41m  \x1b[0m     \x1b[0mhttps://github.com/micr0dust/mvdis-auto-signup");
        console.log("\x1b[41m  \x1b[0m\n\x1b[41m");
        console.log("\x1b[0m");
        return;
    }

    (async() => {
        const browser = await puppeteer.launch({
            headless: true,
            devtools: true
        });
        try {
            for (const user of opt){
                console.log("\x1b[44m");
                console.log("\x1b[0m\n");
                console.log(`嘗試為 \x1b[36m${user.signup.name}\x1b[0m 報名，關鍵字： \x1b[36m${user.target}\x1b[0m`);
                await newProcess(browser, [query, signup, check], user);
            }
            //await page.screenshot({ path: 'result.png' });
            console.log("\x1b[44m");
            console.log("\x1b[0m");
            await browser.close();
        } catch (error) {
            console.log(error);
        }
    })();
});

async function newProcess(browser, process, user){
    const page = await browser.newPage();
    await page.setUserAgent(userAgent);
    await page.bringToFront();
    let data;
    for (const fn of process)
        data= await fn(page,data,user);
    return data;
}

async function query(page, data, user){
    await page.goto('https://www.mvdis.gov.tw/m3-emv-trn/exm/locations#anchor&gsc.tab=0');
    await page.waitForTimeout(1000);
    await page.waitForSelector('#licenseTypeCode');
    //console.log("licenseTypeCode");
    await page.select('#licenseTypeCode', user.licenseTypeCode);
    await page.waitForSelector('#expectExamDateStr');
    //console.log("expectExamDateStr");
    await page.type('#expectExamDateStr', dateStr);
    await page.waitForSelector('#dmvNoLv1');
    //console.log("dmvNoLv1");
    await page.select('#dmvNoLv1', user.dmvNoLv1);
    //console.log("dmvNo");
    await page.waitForSelector('#dmvNo > option:nth-child(2)');
    await page.select('#dmvNo', user.dmvNo);
    await page.evaluate(async() => {
        query();
    });
    await page.waitForSelector('#trnTable > tbody > tr');
    const res = await page.evaluate(async() => {
        function getSignUpTime(date,part,team){
            return [strToDate(date),part,team];
        }      
        function strToDate(str) {
            const year = (parseInt(str.split('年')[0])+1911).toString();
            str=str.split('年')[1];
            const month = str.split('月')[0];
            str=str.split('月')[1];
            const date = str.split('日')[0];
            str=str.split('日')[1];
            return `${year}-${('0'+month).slice(-2)}-${('0'+date).slice(-2)}`
        }
        const table = document.querySelector('#trnTable > tbody');
        let res = [];
        for (let i = 0; i < table.children.length; i++){
            const date = table.children[i].children[0].textContent.toString().replace(/\t/g, '').replace(/\n/g, '');
            const part = (((table.children[i].children[1].textContent.replace(/\t/g, '').replace(/\n/g, '').replace(/ /g, '').split('午')[0]).indexOf('下')!=-1)+1).toString();
            const team = table.children[i].children[1].textContent.replace(/\t/g, '').replace(/ /g, '').split('組別')[1].split('\n')[0];
            res.push({
                date: date,
                doc: table.children[i].children[1].textContent.replace(/\t/g, '').replace(/\n/g, '').replace(/ /g, ''),
                available: parseInt(table.children[i].children[2].textContent.replace(/\t/g, '').replace(/\n/g, '')),
                signupTime: getSignUpTime(date,part,team)
            });
        }
        return res;
    });

    //await page.waitForTimeout(1000000);
    //console.log(res);
    for (const it of res)
        if(isTarget(it,user))
            return it;
    return null;
}

function isTarget(data,user){
    const cond = [
        data.doc.indexOf(user.target)!=-1,
        data.signupTime[0]===user.date,
        data.available
    ];
    const sum = cond.reduce((partialSum, a) => partialSum + a, 0);
    return sum===cond.length;
}

async function signup(page, data, user){
    //console.log(data);
    if(!data) return console.log(`\x1b[33m查無名額\x1b[0m`);;
    await page.evaluate(async(data) => {
        preAdd(data.signupTime[0], data.signupTime[1], data.signupTime[2]);
    }, data);
    await page.waitForSelector('body > table.gap_b2 > tbody > tr:nth-child(2) > td > div:nth-child(17) > div > table > tbody');
    console.log("成功進入報名頁面：")
    const info = await page.evaluate(async() => {
        const tboty = document.querySelector('body > table.gap_b2 > tbody > tr:nth-child(2) > td > div:nth-child(17) > div > table > tbody');
        return {
            "報考照類 Type of Test" : tboty.children[0].children[1].textContent.replace(/\t/g, '').replace(/\n/g, ' '),
            "日期 (星期) Date of Test" : tboty.children[1].children[1].textContent.replace(/\t/g, '').replace(/\n/g, ' '),
            "場次組別 Desc." : tboty.children[2].children[1].textContent.replace(/\t/g, '').replace(/\n/g, ' '),
            "考試地點 Place of Test" : tboty.children[3].children[1].textContent.replace(/\t/g, '').replace(/\n/g, ' ')
        };
    });
    console.log(info);
    await page.waitForSelector('body > div.blockUI.blockMsg.blockPage > div.align_c > a');
    await page.click('body > div.blockUI.blockMsg.blockPage > div.align_c > a');
    await page.waitForSelector('#idNo');
    await page.type('#idNo', user.signup.idNo);
    await page.waitForSelector('#birthdayStr');
    await page.type('#birthdayStr', user.signup.birthdayStr);
    await page.waitForSelector('#name');
    await page.type('#name', user.signup.name);
    await page.waitForSelector('#contactTel');
    await page.type('#contactTel', user.signup.contactTel);
    await page.waitForSelector('#email');
    await page.type('#email', user.signup.email);
    //await page.waitForTimeout(1000000);

    let dialogMSG="";
    page.on('dialog', async dialog => {
        //get alert message
        console.log(`> \x1b[32m${dialog.message()}\x1b[0m`);
        dialogMSG=dialog.message();
        //accept alert
        await dialog.accept();
    });
    await page.evaluate(async() => {
        add();
    });
    await page.waitForTimeout(1000);
    
    if(!dialogMSG || dialogMSG.length <2)
        try {
            await page.waitForSelector('#headerMessage');
            const msg = await page.evaluate(async() => {
                return document.querySelector('#headerMessage').textContent;
            });
            console.log(`> \x1b[33m${msg.length>2?msg:"重複報名"}\x1b[0m`);
        } catch (error) {
            console.log(`> \x1b[31m未知錯誤\x1b[0m`);
        }
    //await page.waitForTimeout(1000000);
}

async function check(page, data, user){
    await page.goto('https://www.mvdis.gov.tw/m3-emv-trn/exm/query#anchor&gsc.tab=0');
    await page.waitForTimeout(1000);
    await page.waitForSelector('#idNo');
    await page.type('#idNo', user.signup.idNo);
    await page.waitForSelector('#birthdayStr');
    await page.type('#birthdayStr', user.signup.birthdayStr);
    await page.evaluate(async() => {
        query();
    });
    try {
        await page.waitForSelector('#form1 > div > div > div > div > a');
    } catch (error) {
        
    }
    await page.screenshot({ path: `result/${user.signup.name}.png`, fullPage: true });
}
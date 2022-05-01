const fetch = require("node-fetch");
const chalk = require("chalk");
const readline = require("readline-sync");
const inquirer = require("inquirer");
const cheerio = require("cheerio");
const { parse } = require("node-html-parser");
const fs = require("fs");

const getChoice = () => new Promise((resolve, reject) => {
    inquirer.prompt([
        {
            type: "list",
            name: "choice",
            message: "Choose a option",
            choices: ["Foto/Video", "Story", "Reels", "Exit"]
        }
    ])
    .then(res => resolve(res))
    .catch(err => reject(err));
});

const urlParser = (url) => {
    const urlSplit = url.split("/");
    const last = urlSplit[urlSplit.length - 1];
    
    if(last[0] === ("?") || last === ""){
        return urlSplit[urlSplit.length - 2];
    }
    return last;
};

const urlChecker = (url) => {
    const reg = new RegExp("(https?://(?:www.)?instagram.com/([^/?#&]+)).*");
    const match = url.match(reg);
    return match;
}

const downloadMedia = (url, type) => new Promise((resolve, reject) => {
    const idVideo = Math.floor(Math.random() * 9999999999);
    const fileName = `${idVideo}.${type ? "mp4" : "jpg"}`;
    console.log(chalk.blue(`[*] Downloading (${fileName})`));
    const res = fetch(url);
    res.then(res => {
        const folder = `downloads/`;
        const file = fs.createWriteStream(folder+fileName);
        res.body.pipe(file);
        file.on("finish", () => {
            file.close();
            resolve(fileName);
        });
    })
    .catch(err => reject(err));
});

const getPostInstagram = (url) => new Promise((resolve, reject) => {
    const shortCodeMedia = urlParser(url);
    const API_URL = `https://www.instagram.com/p/${shortCodeMedia}/embed`;
    fetch(API_URL, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36"
        }
    })
    .then(res =>  res.text())
    .then(body => resolve(body))
    .catch(err => reject(err));   
});

const getVideoLinkFromHtml = (html) => {
    var json = "{\"" + html.substring(html.search("video_url"), html.search("video_url") + 1000);
    json = json.substring(0, crop.search(",")) + "}";
    return JSON.parse(json).video_url;
}

async function downloadSingleMedia(html){
    var urlMedia = "";
    const res = cheerio.load(html).html();
    const root = parse(html);

    if (res.search("video_url") != -1){
        urlMedia = getVideoLinkFromHtml(res);
        type = true;
    }else{
        urlMedia = root.querySelector('img.EmbeddedMediaImage').getAttribute("src");
        type = false;
    }
    while (urlMedia.search("&amp;") != -1) {
        urlMedia = urlMedia.replace("&amp;", "&");
    }
    return [urlMedia, type];    
}

async function downloadMediaAlbum(url){
    var urls = [];

    const html = await getPostInstagram(url);
    var json = "";
    const $ = cheerio.load(html);
    $("script").each((i, el) => {
        const script = $(el).html();
        const reg = new RegExp("window\\.__additionalDataLoaded\\((.*)\\)");
        const match = script.match(reg);
        if(match){
            const res = match[1].replace("'extra',", "");
            json = JSON.parse(res);
        }
    });
    if(json != null){
        if(json.shortcode_media.__typename === "GraphVideo"){
            const urlMedia = json.shortcode_media.video_url;
            const type = true;
            urls.push([urlMedia, type]);
        } else if(json.shortcode_media.__typename === "GraphSidecar"){
            const data = json.shortcode_media.edge_sidecar_to_children.edges;
            console.log(chalk.green(`[+] ${data.length} media found in this album`));
            for(let i = 0; i < data.length; i++){
                const type = data[i].node.is_video;
                var urlMedia = "";
                if(type){
                    urlMedia = data[i].node.video_url;
                } else{
                    urlMedia = data[i].node.display_resources[2].src;
                }
                urls.push([urlMedia, type]);
            }
        }
    } else{
        urlMedia = await downloadSingleMedia(html);
        urls.push(urlMedia);
    }

    if(urls.length > 0){
        for(let i = 0; i < urls.length; i++){
            const url = urls[i][0];
            const type = urls[i][1];
            const fileName = await downloadMedia(url, type);
            console.log(chalk.green(`[+] ${fileName} downloaded`));
        }
    }
};


(async () => {
    console.log(chalk.magenta("Starting Instagram Downloader..."));
    
    const choice = await getChoice();
    if(choice.choice == "Exit"){
        console.log(chalk.red("Exiting..."));
        return;
    }

    if(choice.choice == "Foto/Video"){
        const url = readline.question(chalk.yellow("[*] Enter the URL of the post: "));
        if (!url) {
            console.log(chalk.red("[x] URL is required"));
            return;
        }
        const match = urlChecker(url);
        if(!match){
            console.log(chalk.red("[x] Invalid URL"));
            return;
        }
        downloadMediaAlbum(url);
    } else{
        console.log(chalk.yellow("[!] Coming soon..."));
    }
})();
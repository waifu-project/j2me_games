/**
 * 爬虫代码...
 * 写的很丑, 不要在意细节
 */

const http = require("got")
const cheerio = require('cheerio')
const path = require("path")
const jsonfile = require("jsonfile")
const download = require("download")
const shortid = require('shortid')
const fs = require("fs")
var qjobs = require("qjobs")

// 角色| 动作| 益智
// 策略| 射击| 其他
// 汉化| 赛车| 棋牌
// 代码写的丑又怎么样, 又不是不能用..
const tar2code = (tar) => {
  switch (tar) {
    case "角色":
      return 1
    case "动作":
      return 2
    case "益智":
      return 3
    case "策略":
      return 4
    case "射击":
      return 5
    case "其他":
      return 6
    case "汉化":
      return 7
    case "赛车":
      return 8
    case "棋牌":
      return 9
    default:
      return 0
  }
}

const website = `http://java.52emu.cn`

const getGameInfo = async id => {
  try {
    const url = `${website}/xiangqing.php?id=${id}`
    const c = await http(url)
    const { body } = c
    const $ = cheerio.load(body)
    const arr = Array.from($("a"))
    const downloadURL = path.join(website, cheerio(arr[arr.length - 1]).attr("href").trim()).replace("http:/", "http://")
    const lanzouURL = cheerio(arr[arr.length - 2]).attr("href").trim()
    const a = arr[0]
    const fid = tar2code(cheerio(a).text())
    return {
      downloadURL,
      lanzouURL,
      fid
    }
  } catch (error) {
    console.log("未知错误: ", error)
  }

}

const getAllGames = async () => {
  const resp = await http(`${website}/?q=all`)
  const { body } = resp
  const $ = cheerio.load(body)
  const match = "xiangqing.php?id="
  const arr = []
  Array.from($("a")).filter(item => {
    const $1 = cheerio(item)
    const href = $1.attr("href")
    if (href.length >= 1 && href.startsWith(match)) {
      const id = href.replace(match, "")
      const title = $1.text()
      arr.push({
        title,
        id
      })
    }
  })
  return arr
}

const printGame = (arr) => {
  const l = arr.length
  console.log("共有: ", l, "款游戏")
}

const append = (file, data)=> {
  fs.appendFile(file, data, function (err) {
  });
}

; (async () => {

  const games = await getAllGames()
  printGame(games)
  const json_file = "./games.json"
  const dist_dir = "dist"
  if (!fs.existsSync(dist_dir)) {
    fs.mkdirSync(dist_dir)
  }
  const obj = []
  const q = new qjobs({maxConcurrency:1});
  const fail_json = "./fail.txt"
  games.forEach(async (item, index) => {

    q.add(async (args, next)=> {
      try {
        const item = args[0]
        const { title, id } = item
        console.log("开始下载: ", title, id)
        const { downloadURL, lanzouURL, fid } = await getGameInfo(id)
        const e = path.extname(downloadURL)
        const uid = shortid.generate() + e
        const file_id = `/${dist_dir}/${uid}`
        const out = encodeURI(downloadURL)
        await download(out, dist_dir, {
          filename: uid
        })
        const ctx = {
          title,
          file_id,
          lanzou_url: lanzouURL,
          fid, // 分类
          backups: [
            downloadURL
          ]
        }
        obj.push(ctx)
        jsonfile.writeFileSync(json_file, obj)
        next()
      } catch (error) {
        console.log("下载失败: ", item.title, item.id)
        const txt = item.id + "\n"
        append(fail_json, txt)
        next()
      }
      
    }, [ item ])

  })

  q.on('start',function() {
    console.log('Starting ...');
  });

  q.on('end',function() {
      console.log('... All jobs done');
  });

  q.run();
})()
const {get} = require("axios")
const YAML = require('yaml')
const fs = require('fs')
const path = require('path')

// 动态加载JSON文件的函数
function requireJson(relativePath) {
    try {
        const fullPath = path.join(__dirname, relativePath) // 构建完整的文件路径
        const fileContent = fs.readFileSync(fullPath, 'utf8') // 读取文件内容
        return JSON.parse(fileContent) // 解析JSON并返回
    } catch (error) {
        console.error('Error reading JSON file:', error)
        return null
    }
}

// 动态加载Yaml文件的函数
function requireYaml(relativePath) {
    try {
        const fullPath = path.join(__dirname, relativePath) // 构建完整的文件路径
        const fileContent = fs.readFileSync(fullPath, 'utf8') // 读取文件内容
        return (YAML.parse(fileContent)).reverse() // 解析JSON并返回
    } catch (error) {
        console.error('Error reading JSON file:', error)
        return null
    }
}

function getImg(game, type, name) {
    if (game === "genshin") {
        game = "gi"
    }
    if (name === "三月七 - 存护") {
        return ""
    }
    let data = requireJson(`../data/hakush/${game}/${type.toLowerCase()}.json`)
    if (!data || !(data[name])) {
        console.log("getImg failed ", name, data)
    }
    return data?.[name]["iconUrl"]
}

function getRelativePath(game, type) {
    return `../data/hakush/${game}/${type}.json`
}

//首字母大写
const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1)
//首字母小写
const lowerCaseFirstLetter = (string) => string.charAt(0).toLowerCase() + string.slice(1)

let params = {
    11: {
        game: "hsr",
        type: "Character"
    },
    12: {
        game: "hsr",
        type: "Weapon"
    },
    301: {
        game: "gi",
        type: "Character"
    },
    302: {
        game: "gi",
        type: "Weapon"
    },
    2001: {
        game: "zzz",
        type: "Character"
    },
    3001: {
        game: "zzz",
        type: "Weapon"
    },

}


let getVersions = pool => {
    let versionNum = [[1, 6], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8]]
    if (pool === 11 || pool === 12) {
        versionNum = [[1, 6], [2, 7], [3, 8], [4, 8], [5, 8], [6, 8]]
    }
    if (pool === 2001 || pool === 3001) {
        versionNum = [[1, 7], [2, 7], [3, 8], [4, 8], [5, 8], [6, 8]]
    }
    const versions = versionNum.map(([a, b]) => Array.from(new Array(b + 1).keys()).map(v => [`${a}.${v}.1`, `${a}.${v}.2`].join(';')).join(";")).join(";").split(";")

    return versions
}

const findObj = (name, Obj) => {
    if (!name) {
        return ""
    }
    if (Object.keys(Obj).includes(name + "")) {
        return Obj[name + ""]
    }
    return name
}
//replace nickName or abbr.
let nickNames = {
    // "鼬鼠党欢迎你": "鼹鼠党欢迎你",
    // "点个关注吧": "点个关注吧！",
    // "『我』的诞生": "「我」的诞生",
    // "维序者·特化型": "维序者-特化型",
}

const getName = name => findObj(name, nickNames)

let weaponTypes = {
    "WEAPON_SWORD_ONE_HAND": "Sword",
    "WEAPON_CATALYST": "Catalyst",
    "WEAPON_CLAYMORE": "Claymore",
    "WEAPON_BOW": "Bow",
    "WEAPON_POLE": "Polearm"
}
let damageTypes = {
    "lightning": "thunder",
}

let paths = {
    "destruction": "warrior",
    "hunt": "rogue",
    "erudition": "mage",
    "harmony": "shaman",
    "nihility": "warlock",
    "preservation": "knight",
    "abundance": "priest",
}


let ZZZTypes = {
    "1": "Attack",
    "2": "Stun",
    "3": "Anomaly",
    "4": "Support",
    "5": "Defense",
    "6": "Rupture",
}

let ZZZTypesCN = {
    "1": "强攻",
    "2": "击破",
    "3": "异常",
    "4": "支援",
    "5": "防护",
    "6": "命破",
}

let ZZZElement = {
    "200": "Physical",
    "201": "Fire",
    "202": "Ice",
    "203": "Electric",
    "205": "Ether",
}

let ZZZElementCN = {
    "200": "物理",
    "201": "火属性",
    "202": "冰属性",
    "203": "电属性",
    "205": "以太",
}

const getWeaponType = name => findObj(name, weaponTypes)
const getDamageType = name => findObj(name, damageTypes)
const getPath = name => findObj(name, paths)

const get3ZType = name => findObj(name, ZZZTypes)
const get3ZTypeCN = name => findObj(name, ZZZTypesCN)
const get3ZElement = name => findObj(name, ZZZElement)
const get3ZElementCN = name => findObj(name, ZZZElementCN)

const getId2 = (name, pool) => {
    let {game, type} = params[pool]
    let data = requireJson(getRelativePath(game, type.toLowerCase()))
    let name2 = getName(name)

    let find = Object.values(data).find(a => (pool === 2001 ? a.cn.includes(name2) : a.cn === name2))
    if (!find) {
        console.log(`${pool},${name}无对应数据`)
        return
    }

    let returnObj = {
        itemId: +find.id,
        imageUrl: getImg(game, type, name2),
        itemType: type,
        name: find.cn,
        nameEn: find.EN ? find.EN : find.en,
    }

    switch (pool) {
        case 11: {
            let {
                damageType, rank, baseType
            } = find
            return {
                ...returnObj,
                damageType: lowerCaseFirstLetter(damageType),
                element: lowerCaseFirstLetter(getDamageType(damageType)),
                rankType: +rank.slice(-1),
                avatarBaseType: lowerCaseFirstLetter(baseType),
                weaponType: lowerCaseFirstLetter(getPath(baseType)),
            }
        }
        case 12: {
            let {
                rank, baseType
            } = find
            return {
                ...returnObj,
                rankType: +rank.slice(-1),
                avatarBaseType: lowerCaseFirstLetter(baseType),
                weaponType: lowerCaseFirstLetter(getPath(baseType)),
            }
        }
        case 301: {
            let {
                element,
                rank,
                weapon
            } = find
            return {
                ...returnObj,
                weaponType: getWeaponType(weapon),
                rankType: rank === "QUALITY_PURPLE" ? 4 : 5,
                element: element
            }
        }
        case 302: {
            let {
                type,
                rank
            } = find
            return {
                ...returnObj,
                weaponType: getWeaponType(type),
                rankType: rank,
            }
        }
        case 2001: {
            let {
                rank,
                type,
                element,
            } = find
            return {
                ...returnObj,
                weaponType: get3ZType(type),
                weaponTypeCN: get3ZTypeCN(type),
                rankType: rank + 1,
                element: get3ZElement(element),
                elementCN: get3ZElementCN(element),
            }
        }
        case 3001: {
            let {
                rank,
                type,
            } = find
            return {
                ...returnObj,
                weaponType: get3ZType(type),
                weaponTypeCN: get3ZTypeCN(type),
                rankType: rank + 1,
            }
        }
        default:
            console.log(`${pool},${name}无对应数据`)
    }
}

const getVersion = (i, pool) => {
    let versionsTemp = getVersions(pool).slice(0)
    if (pool === 301) {
        //genshin Character
        versionsTemp = [...versionsTemp, "1.3.3"].sort()
    }
    if (pool === 11 || pool === 12) {
        //hsr
        versionsTemp = [...versionsTemp, "3.8.3"].sort()
    }
    if (pool === 2001 || pool === 3001) {
        //zzz
        versionsTemp = versionsTemp.filter(item => item !== "1.4.2").sort()
    }
    return versionsTemp[i]
}
const fetchGachaData = async (pool, game, type) => {

    //https://gitee.com/yoimiya-kokomi/Yunzai-Bot/raw/main/plugins/genshin/defSet/pool/${pool}.yaml
    //https://gitee.com/yoimiya-kokomi/Miao-Yunzai/raw/master/plugins/genshin/defSet/pool/${pool}.yaml
    //https://genshin-gacha-banners-keypj.vercel.app/${pool}.yaml
    //https://github.com/KeyPJ/FetchData/raw/refs/heads/main/data/manual/${pool}.yaml
    // const res = await get(` https://raw.githubusercontent.com/KeyPJ/FetchData/refs/heads/main/data/manual/${pool}.yaml`, {
    //     // `proxy` means the request actually goes to the server listening
    //     // on localhost:3000, but the request says it is meant for
    //     // 'http://httpbin.org/get?answer=42'
    //     // proxy: {
    //     //     host: '127.0.0.1',
    //     //     port: 17890
    //     // }
    // })

    const parse = requireYaml(`../data/manual/${pool}.yaml`)
    const data = parse.map((gachaData, i) => {
        const {from, to, five, four} = gachaData
        const info5 = five.map(c => getId2(c, pool))
        const info4 = four ? four.map(c => getId2(c, pool)) : []
        return {
            version: getVersion(i, pool),
            items: [...info5, ...info4].filter(a => !!a && !!a.rankType),
            start: from,
            end: to,
        }
    })
    if (game === "genshin") {
        game = "gi"
    }
    let directoryPath = path.join(__dirname, `../data/gacha/${game}`)
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, {recursive: true})
    }
    const characterFilePath = path.join(__dirname, `../data/gacha/${game}`, `${type.toLowerCase()}.json`)
    fs.writeFileSync(characterFilePath, JSON.stringify(data.reverse(), "", "\t"))
}


async function fetchData(id) {
    for (let key of Object.keys(params)) {
        let {game, type} = params[key]
        if (!id || game === id) {
            await fetchGachaData(+key, game, type)
        }
    }
}

let id = process.argv.slice(2)[0] || ""
fetchData(id)


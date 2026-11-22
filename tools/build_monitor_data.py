#!/usr/bin/env python3
"""Build the static Monitor snapshot from the public newsnow hot-list API.

Self-contained on purpose: the province / country / category tables are inlined
so this can run in a GitHub Action with nothing but Python's standard library.
The rules mirror Quanta's sentiment.py.

Output: ../monitor-data.js (window.XYC_MONITOR = {...})
"""

import json
import os
import pathlib
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

OUT = pathlib.Path(__file__).resolve().parent.parent / "monitor-data.js"

API_URL = "https://newsnow.busiyi.world/api/s"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

PLATFORMS = [('weibo', '微博', 'Weibo'),
 ('douyin', '抖音', 'Douyin'),
 ('zhihu', '知乎', 'Zhihu'),
 ('baidu', '百度热搜', 'Baidu Hot Search'),
 ('toutiao', '今日头条', 'Toutiao'),
 ('bilibili-hot-search', 'bilibili 热搜', 'Bilibili Hot Search'),
 ('thepaper', '澎湃新闻', 'The Paper'),
 ('ifeng', '凤凰网', 'ifeng'),
 ('tieba', '贴吧', 'Tieba'),
 ('wallstreetcn-hot', '华尔街见闻', 'Wallstreetcn Hot'),
 ('cls-hot', '财联社热门', 'CLS Hot'),
 ('xueqiu-hotstock', '雪球热股', 'Xueqiu Hot Stocks'),
 ('jin10', '金十数据', 'Jin10'),
 ('v2ex', 'V2EX', 'V2EX'),
 ('ithome', 'IT之家', 'ITHome'),
 ('zaobao', '联合早报', 'Lianhe Zaobao'),
 ('hackernews', 'Hacker News', 'Hacker News'),
 ('github-trending-today', 'GitHub 今日趋势', 'GitHub Trending Today')]

CATEGORIES_EN = {'AI': 'AI',
 '时政': 'Politics',
 '国际': 'World',
 '经济': 'Economy',
 '科技': 'Tech',
 '社会': 'Society',
 '体育': 'Sports',
 '娱乐': 'Entertainment',
 '其他': 'Other'}

PROVINCES = ['北京',
 '天津',
 '河北',
 '山西',
 '内蒙古',
 '辽宁',
 '吉林',
 '黑龙江',
 '上海',
 '江苏',
 '浙江',
 '安徽',
 '福建',
 '江西',
 '山东',
 '河南',
 '湖北',
 '湖南',
 '广东',
 '广西',
 '海南',
 '重庆',
 '四川',
 '贵州',
 '云南',
 '西藏',
 '陕西',
 '甘肃',
 '青海',
 '宁夏',
 '新疆',
 '台湾',
 '香港',
 '澳门']

PROVINCE_ALIASES = {'北京市': '北京',
 '上海市': '上海',
 '天津市': '天津',
 '重庆市': '重庆',
 '广东省': '广东',
 '深圳市': '广东',
 '广州': '广东',
 '深圳': '广东',
 '东莞': '广东',
 '浙江省': '浙江',
 '杭州': '浙江',
 '江苏省': '江苏',
 '南京': '江苏',
 '苏州': '江苏',
 '四川省': '四川',
 '成都': '四川',
 '湖北省': '湖北',
 '武汉': '湖北',
 '湖南省': '湖南',
 '长沙': '湖南',
 '河南省': '河南',
 '郑州': '河南',
 '山东省': '山东',
 '济南': '山东',
 '青岛': '山东',
 '福建省': '福建',
 '厦门': '福建',
 '福州': '福建',
 '陕西省': '陕西',
 '西安': '陕西',
 '辽宁省': '辽宁',
 '沈阳': '辽宁',
 '大连': '辽宁',
 '吉林省': '吉林',
 '长春': '吉林',
 '黑龙江': '黑龙江',
 '哈尔滨': '黑龙江',
 '安徽省': '安徽',
 '合肥': '安徽',
 '江西省': '江西',
 '南昌': '江西',
 '河北省': '河北',
 '石家庄': '河北',
 '山西省': '山西',
 '太原': '山西',
 '云南省': '云南',
 '昆明': '云南',
 '贵州省': '贵州',
 '贵阳': '贵州',
 '广西壮族自治区': '广西',
 '南宁': '广西',
 '海南省': '海南',
 '海口': '海南',
 '甘肃省': '甘肃',
 '兰州': '甘肃',
 '青海省': '青海',
 '西宁': '青海',
 '宁夏回族自治区': '宁夏',
 '银川': '宁夏',
 '新疆维吾尔自治区': '新疆',
 '乌鲁木齐': '新疆',
 '西藏自治区': '西藏',
 '拉萨': '西藏',
 '内蒙古自治区': '内蒙古',
 '呼和浩特': '内蒙古',
 '香港特别行政区': '香港',
 '澳门特别行政区': '澳门',
 '台湾省': '台湾'}

COUNTRIES = {'美国': 'United States of America',
 '日本': 'Japan',
 '韩国': 'South Korea',
 '朝鲜': 'North Korea',
 '俄罗斯': 'Russia',
 '乌克兰': 'Ukraine',
 '英国': 'United Kingdom',
 '法国': 'France',
 '德国': 'Germany',
 '意大利': 'Italy',
 '西班牙': 'Spain',
 '葡萄牙': 'Portugal',
 '荷兰': 'Netherlands',
 '比利时': 'Belgium',
 '瑞士': 'Switzerland',
 '瑞典': 'Sweden',
 '挪威': 'Norway',
 '芬兰': 'Finland',
 '丹麦': 'Denmark',
 '波兰': 'Poland',
 '奥地利': 'Austria',
 '希腊': 'Greece',
 '土耳其': 'Turkey',
 '印度': 'India',
 '巴基斯坦': 'Pakistan',
 '孟加拉国': 'Bangladesh',
 '越南': 'Vietnam',
 '泰国': 'Thailand',
 '马来西亚': 'Malaysia',
 '新加坡': 'Singapore',
 '印度尼西亚': 'Indonesia',
 '菲律宾': 'Philippines',
 '缅甸': 'Myanmar',
 '柬埔寨': 'Cambodia',
 '老挝': 'Laos',
 '蒙古': 'Mongolia',
 '哈萨克斯坦': 'Kazakhstan',
 '阿富汗': 'Afghanistan',
 '伊朗': 'Iran',
 '伊拉克': 'Iraq',
 '以色列': 'Israel',
 '巴勒斯坦': 'Palestine',
 '沙特阿拉伯': 'Saudi Arabia',
 '阿联酋': 'United Arab Emirates',
 '卡塔尔': 'Qatar',
 '叙利亚': 'Syria',
 '黎巴嫩': 'Lebanon',
 '埃及': 'Egypt',
 '南非': 'South Africa',
 '尼日利亚': 'Nigeria',
 '埃塞俄比亚': 'Ethiopia',
 '肯尼亚': 'Kenya',
 '摩洛哥': 'Morocco',
 '阿尔及利亚': 'Algeria',
 '利比亚': 'Libya',
 '苏丹': 'Sudan',
 '加拿大': 'Canada',
 '墨西哥': 'Mexico',
 '巴西': 'Brazil',
 '阿根廷': 'Argentina',
 '智利': 'Chile',
 '秘鲁': 'Peru',
 '哥伦比亚': 'Colombia',
 '委内瑞拉': 'Venezuela',
 '古巴': 'Cuba',
 '澳大利亚': 'Australia',
 '新西兰': 'New Zealand',
 '格陵兰': 'Greenland',
 '冰岛': 'Iceland',
 '爱尔兰': 'Ireland',
 '捷克': 'Czechia',
 '匈牙利': 'Hungary',
 '罗马尼亚': 'Romania',
 '塞尔维亚': 'Serbia',
 '克罗地亚': 'Croatia',
 '保加利亚': 'Bulgaria',
 '白俄罗斯': 'Belarus',
 '立陶宛': 'Lithuania',
 '拉脱维亚': 'Latvia',
 '爱沙尼亚': 'Estonia',
 '格鲁吉亚': 'Georgia',
 '亚美尼亚': 'Armenia',
 '阿塞拜疆': 'Azerbaijan',
 '乌兹别克斯坦': 'Uzbekistan',
 '吉尔吉斯斯坦': 'Kyrgyzstan',
 '塔吉克斯坦': 'Tajikistan',
 '土库曼斯坦': 'Turkmenistan',
 '尼泊尔': 'Nepal',
 '斯里兰卡': 'Sri Lanka',
 '也门': 'Yemen',
 '约旦': 'Jordan',
 '科威特': 'Kuwait',
 '阿曼': 'Oman',
 '突尼斯': 'Tunisia',
 '加纳': 'Ghana',
 '坦桑尼亚': 'Tanzania',
 '乌干达': 'Uganda',
 '安哥拉': 'Angola',
 '津巴布韦': 'Zimbabwe',
 '莫桑比克': 'Mozambique',
 '马达加斯加': 'Madagascar'}

CATEGORIES = [('AI',
  ['AI', '人工智能', '大模型', '机器人', '算力', '芯片', 'GPT', '算法', '智能体', '英伟达', 'OpenAI', 'DeepSeek']),
 ('时政', ['习近平', '国务院', '中央', '两会', '人大', '政协', '外交部', '省委', '市委', '书记', '部长', '政策', '会谈']),
 ('国际',
  ['美国',
   '俄罗斯',
   '乌克兰',
   '日本',
   '韩国',
   '欧盟',
   '联合国',
   '北约',
   '以色列',
   '巴勒斯坦',
   '伊朗',
   '关税',
   '制裁',
   '总统',
   '总理']),
 ('经济',
  ['股市',
   'A股',
   '港股',
   '美股',
   '黄金',
   '油价',
   '房价',
   '楼市',
   '人民币',
   '汇率',
   '央行',
   '降息',
   'GDP',
   '消费',
   '就业',
   '工资',
   '债券',
   '基金']),
 ('科技', ['手机', '苹果', '华为', '小米', '特斯拉', '新能源', '航天', '卫星', '5G', '操作系统', '发布会', '游戏', '元宇宙']),
 ('社会',
  ['事故',
   '通报',
   '警方',
   '法院',
   '判刑',
   '火灾',
   '地震',
   '台风',
   '暴雨',
   '洪水',
   '高温',
   '寒潮',
   '诈骗',
   '失联',
   '救援',
   '景区',
   '医院',
   '学校',
   '高考']),
 ('体育', ['足球', '篮球', '国足', '中超', 'NBA', '奥运', '世界杯', '冠军', '比赛', '球员', '乒乓', '羽毛球']),
 ('娱乐', ['明星', '电影', '电视剧', '综艺', '演唱会', '热搜', '粉丝', '演员', '导演', '票房', '歌手'])]

PROVINCE_EN = {'北京': 'Beijing',
 '天津': 'Tianjin',
 '河北': 'Hebei',
 '山西': 'Shanxi',
 '内蒙古': 'Inner Mongolia',
 '辽宁': 'Liaoning',
 '吉林': 'Jilin',
 '黑龙江': 'Heilongjiang',
 '上海': 'Shanghai',
 '江苏': 'Jiangsu',
 '浙江': 'Zhejiang',
 '安徽': 'Anhui',
 '福建': 'Fujian',
 '江西': 'Jiangxi',
 '山东': 'Shandong',
 '河南': 'Henan',
 '湖北': 'Hubei',
 '湖南': 'Hunan',
 '广东': 'Guangdong',
 '广西': 'Guangxi',
 '海南': 'Hainan',
 '重庆': 'Chongqing',
 '四川': 'Sichuan',
 '贵州': 'Guizhou',
 '云南': 'Yunnan',
 '西藏': 'Tibet',
 '陕西': 'Shaanxi',
 '甘肃': 'Gansu',
 '青海': 'Qinghai',
 '宁夏': 'Ningxia',
 '新疆': 'Xinjiang',
 '台湾': 'Taiwan',
 '香港': 'Hong Kong',
 '澳门': 'Macao'}

EXTRA_WORDS = {'AI': ['模型', '训练', '推理', '智能'],
 '时政': ['全军', '军委', '国防', '会晤', '访华', '首相', '外长'],
 '国际': ['特朗普', '普京', '泽连斯基', '拜登', '冲突', '战争', '停火', '大使', '峰会', '条约', '领土', '边境'],
 '经济': ['顺丰',
        '快递',
        '供应链',
        '采购',
        '市值',
        '上市',
        '融资',
        '财报',
        '营收',
        '涨价',
        '降价',
        '利率',
        '通胀',
        '出口',
        '进口',
        '黄金'],
 '科技': ['半导体', 'PCB', '火箭', '发射', '卫星', '操作系统', '芯片'],
 '社会': ['死亡', '遇难', '受伤', '判决', '起诉', '落马', '调查', '救援'],
 '体育': ['拳王', '联赛', '球队', '进球', '夺冠', '网球'],
 '娱乐': ['恋情', '结婚', '离婚', '剧组', '开机', '红毯', '偶像']}


def match_region(title):
    for alias, province in PROVINCE_ALIASES.items():
        if alias in title:
            return province, "province"
    for name in PROVINCES:
        if name in title:
            return name, "province"
    for alias, english in COUNTRIES.items():
        if alias in title:
            return english, "country"
    return "", ""


def match_category(title):
    for label, words in CATEGORIES:
        for word in words:
            if word in title:
                return label
    for label, words in EXTRA_WORDS.items():
        for word in words:
            if word in title:
                return label
    return "其他"


def fetch(platform_id, timeout=15):
    url = f"{API_URL}?id={platform_id}&latest"
    last_error = ""
    for attempt in range(2):
        request = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
            last_error = ""
            break
        except Exception as error:  # noqa: BLE001
            last_error = str(error)
            if attempt == 0:
                time.sleep(0.8)
    if last_error:
        return platform_id, [], last_error
    if str(data.get("status") or "") not in ("success", "cache"):
        return platform_id, [], "bad status"
    items = []
    for index, item in enumerate(data.get("items") or [], start=1):
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        items.append({
            "title": title,
            "url": item.get("url") or item.get("mobileUrl") or "",
            "rank": index,
        })
        if len(items) >= 40:
            break
    return platform_id, items, ""


def main():
    started = time.time()
    results = {}
    errors = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for platform_id, items, error in pool.map(fetch, [p[0] for p in PLATFORMS]):
            results[platform_id] = items
            if error:
                errors.append((platform_id, error))
            print(f"  {platform_id:24s} {len(items):3d} items  {error}", file=sys.stderr)

    merged = {}
    for platform_id, items in results.items():
        for item in items:
            entry = merged.setdefault(item["title"], {
                "title": item["title"], "url": item["url"],
                "rank": item["rank"], "platforms": [],
            })
            entry["rank"] = min(entry["rank"], item["rank"])
            entry["platforms"].append(platform_id)
            if not entry["url"]:
                entry["url"] = item["url"]

    names = {pid: (zh, en) for pid, zh, en in PLATFORMS}
    country_zh = {english: chinese for chinese, english in COUNTRIES.items()}
    events = []
    for entry in merged.values():
        region, kind = match_region(entry["title"])
        ids = entry["platforms"]
        events.append({
            "title": entry["title"],
            "url": entry["url"],
            "rank": entry["rank"],
            "regions": [],
            "region": region,
            "kind": kind,
            "category": match_category(entry["title"]),
            "platform": names[ids[0]][0] if ids else "",
            "platform_en": names[ids[0]][1] if ids else "",
            "platforms": ids,
            "heat": max(1, 62 - int(entry["rank"])) * (1 + max(0, len(ids) - 1)),
        })
    events.sort(key=lambda item: -item["heat"])

    regions = {}
    for event in events:
        if not event["region"]:
            continue
        box = regions.setdefault(event["region"], {
            "name": event["region"],
            "name_zh": event["region"] if event["kind"] == "province"
                       else country_zh.get(event["region"], event["region"]),
            "name_en": PROVINCE_EN.get(event["region"], event["region"])
                       if event["kind"] == "province" else event["region"],
            "kind": event["kind"], "count": 0,
        })
        box["count"] += 1

    categories = []
    counts = {}
    for event in events:
        counts[event["category"]] = counts.get(event["category"], 0) + 1
    for label, _ in [("全部", [])] + CATEGORIES + [("其他", [])]:
        if label == "全部":
            categories.append({"key": "全部", "name_zh": "全部", "name_en": "All",
                               "count": len(events)})
        elif counts.get(label):
            categories.append({"key": label, "name_zh": label,
                               "name_en": CATEGORIES_EN.get(label, label),
                               "count": counts[label]})

    now = datetime.now(timezone.utc).astimezone()
    payload = {
        "generated": int(started * 1000),
        "generated_iso": now.isoformat(timespec="seconds"),
        "source": "newsnow public hot-list API",
        "source_url": "https://newsnow.busiyi.world",
        "platforms": [
            {"id": pid, "name": zh, "name_en": en, "count": len(results.get(pid) or [])}
            for pid, zh, en in PLATFORMS
        ],
        "categories": categories,
        "regions": regions,
        "events": events,
        "totals": {
            "events": len(events),
            "regions": len(regions),
            "provinces": sum(1 for r in regions.values() if r["kind"] == "province"),
            "countries": sum(1 for r in regions.values() if r["kind"] == "country"),
            "platforms": len(PLATFORMS),
            "live_platforms": sum(1 for p in PLATFORMS if results.get(p[0])),
        },
        "errors": errors,
    }
    OUT.write_text(
        "/* generated by tools/build_monitor_data.py — a static snapshot of public hot lists */\n"
        "window.XYC_MONITOR = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT} — {len(events)} events, {len(regions)} regions, "
          f"{payload['totals']['platforms']}/{len(PLATFORMS)} platforms", file=sys.stderr)


if __name__ == "__main__":
    main()

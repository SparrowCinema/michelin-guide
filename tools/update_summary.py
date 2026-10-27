"""Chinese PR description for the rolling update (used by update-data.yml).

python3 tools/update_summary.py report.json [watch.json] [updates.out] [editions.json]
"""
import json, sys, os
LV = ['三星', '二星', '一星', '必比登', '入选']
load = lambda p: json.load(open(p, encoding="utf8")) if p and os.path.exists(p) and os.path.getsize(p) else None
r = load(sys.argv[1]); watch = load(sys.argv[2]) if len(sys.argv) > 2 else None
upd = None
if len(sys.argv) > 3 and os.path.exists(sys.argv[3]):
    try: upd = json.loads(open(sys.argv[3], encoding="utf8").read().strip().splitlines()[-1])
    except Exception: upd = None
eds = load(sys.argv[4]) if len(sys.argv) > 4 else None
retired = [l.strip() for l in open(sys.argv[5], encoding="utf8")] if len(sys.argv) > 5 and os.path.exists(sys.argv[5]) else []
retired = [os.path.basename(x) for x in retired if x]

up = [c for c in r['award_changes'] if c['award'] < c['previous_award']]
down = [c for c in r['award_changes'] if c['award'] > c['previous_award']]
print("自动滚动更新：米其林上游名单与各地指南版本。核对无误后点 **Squash and merge** 即可上线，首页顶部的「本次更新」会同步显示。\n")
print(f"| 变化 | 数量 |\n|---|---|\n| 新增餐厅 | {len(r['added'])} |\n| 移出名单 | {len(r['removed'])} |\n| 升级 | {len(up)} |\n| 降级 / 调整 | {len(down)} |\n")
if watch and watch.get("added"):
    print("**新发布的指南版本**（取自米其林官网发布会文章，日期为文章发布日期，请核对）：\n")
    for a in watch["added"]: print("- " + a)
    print()
if upd and upd.get("synced"):
    print("**本次已同步进名单的新版指南**：" + "、".join(upd["synced"]) + "\n")
if retired:
    print("**上游已追上、撤掉的官网名单覆盖**：" + "、".join(retired) + "\n")
if eds:
    pend = [f'{g["zh"]} {e["year"]}（{e["released"]} 发布）' for g in eds["guides"] for e in g["editions"] if not e.get("synced")]
    if pend: print("**已发布、等数据源更新的版本**：" + "、".join(pend) + "\n")
    miss = [f'{g["zh"]} {e["year"] or "?"}' for g in eds["guides"] for e in g["editions"] if e.get("synced") and not e.get("released")]
    if miss: print("**缺少官方发布日期**（可在 tools/editions.json 补上）：" + "、".join(miss) + "\n")
def block(title, rows, fmt, limit=40):
    if not rows: return
    print(f"<details><summary>{title}（{len(rows)}）</summary>\n")
    for x in rows[:limit]: print('- ' + fmt(x))
    if len(rows) > limit: print(f'- …另有 {len(rows) - limit} 家')
    print('\n</details>\n')
block('新增', r['added'], lambda x: f"{x['name']} · {LV[x['award']]}")
block('升级', up, lambda x: f"{x['name']} · {LV[x['previous_award']]} → {LV[x['award']]}")
block('降级 / 调整', down, lambda x: f"{x['name']} · {LV[x['previous_award']]} → {LV[x['award']]}")
block('移出名单', r['removed'], lambda x: f"{x['name']} · 原 {LV[x['award']]}")
print("注意：移出名单只表示上游数据里没有这家店，可能是改了网址或地区名单尚未发布，不一定是闭店或摘星。新店暂无中文名，会先显示英文名。")

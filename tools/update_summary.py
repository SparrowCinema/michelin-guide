"""Turn tools/check_updates.py's report into a Chinese PR description (used by update-data.yml)."""
import json, sys
LV = ['三星', '二星', '一星', '必比登', '入选']
r = json.load(open(sys.argv[1]))
up = [c for c in r['award_changes'] if c['award'] < c['previous_award']]
down = [c for c in r['award_changes'] if c['award'] > c['previous_award']]
print(f"米其林上游名单有变化，已按最新数据重建 `data.json`。核对无误后点 **Squash and merge** 即可上线。\n")
print(f"| 变化 | 数量 |\n|---|---|\n| 新增餐厅 | {len(r['added'])} |\n| 移出名单 | {len(r['removed'])} |\n| 升级 | {len(up)} |\n| 降级 / 调整 | {len(down)} |\n")
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

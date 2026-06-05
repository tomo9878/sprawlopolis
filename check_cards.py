import json
with open('src/game/cards.json', encoding='utf-8') as f:
    data = json.load(f)
for c in data['cards']:
    s = c['scoring']
    desc = s.get('description','')
    print(f"Card {c['id']:2d} ({c['name']:<22}) type={s['type']:<25} | {desc[:50]}")

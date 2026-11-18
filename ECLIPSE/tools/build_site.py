#!/usr/bin/env python3
"""Gera site/index.html (página de download) com imagens dos modelos reais e o pacote embutido."""
import base64, io, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "site", "img")
def img(name, size):
    im = Image.open(os.path.join(IMG, name + ".png")).convert("RGBA")
    im.thumbnail((size, size))
    b = io.BytesIO(); im.save(b, "WEBP", quality=88)
    return "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()
addon = open(os.path.join(ROOT, "dist", "ECLIPSE_Shadow_Sovereign.mcaddon"), "rb").read()
B64 = base64.b64encode(addon).decode()
SIZE = f"{len(addon)/1024/1024:.1f}"
RAW = "https://github.com/jeanvicen/2d-platformer/raw/ccr-4f2624e6-c75bcj/ECLIPSE/dist/ECLIPSE_Shadow_Sovereign.mcaddon"
creatures = [("umbra","Umbra","Lobo das Sombras"),("nyx","Nyx","Pantera do Eclipse"),("aegis","Aegis","Guardião Blindado"),("nox","Nox","Dragão Negro"),("vesper","Vesper","Fênix Sombria"),("corvus","Corvus","Corvos batedores"),("serpent","Serpent","Serpente Sombria"),("stag","Stag","Cervo Astral"),("golem","Golem","Colosso de Sombra"),("manta","Manta","Arraia das Sombras")]
relics = [("eclipse_hammer","Martelo do Eclipse"),("eclipse_axe","Machado do Eclipse"),("shadow_sword","Espada Sombria"),("astral_spear","Lança Astral"),("eclipse_scythe","Foice do Eclipse"),("celestial_bow","Arco Celestial"),("guardian_shield","Escudo do Guardião"),("titan_gauntlets","Manoplas do Titã"),("shadow_chains","Correntes de Sombra")]
wings = [("wings_wings_shadow","Asas Negras"),("wings_wings_celestial","Asas Celestiais"),("wings_wings_void","Asas do Vazio"),("wings_wings_dragon","Asas de Dragão")]
forms = [("form_wolf","Lobo"),("form_panther","Pantera"),("form_eagle","Águia"),("form_serpent","Serpente"),("form_titan","Titã"),("form_guardian","Guardião")]
cards = "".join(f'<figure class="card"><img src="{img(k,260)}" alt="{n}" loading="lazy"><figcaption><b>{n}</b><span>{t}</span></figcaption></figure>' for k,n,t in creatures)
rel = "".join(f'<figure class="mini"><img src="{img("item_"+k,140)}" alt="{n}"><figcaption>{n}</figcaption></figure>' for k,n in relics)
wg = "".join(f'<figure class="mini wide"><img src="{img(k,220)}" alt="{n}"><figcaption>{n}</figcaption></figure>' for k,n in wings)
fm = "".join(f'<figure class="mini"><img src="{img(k,160)}" alt="Forma {n}"><figcaption>{n}</figcaption></figure>' for k,n in forms)
LYRA = img("lyra", 380); NOX = img("nox", 520)
html = open(os.path.join(ROOT, "tools", "site_template.html"), encoding="utf-8").read()
for k, v in {"%%CARDS%%":cards,"%%RELICS%%":rel,"%%WINGS%%":wg,"%%FORMS%%":fm,"%%LYRA%%":LYRA,"%%NOX%%":NOX,"%%B64%%":B64,"%%SIZE%%":SIZE,"%%RAW%%":RAW}.items():
    html = html.replace(k, v)
open(os.path.join(ROOT, "site", "index.html"), "w", encoding="utf-8").write(html)
print("site/index.html", round(len(html)/1024/1024,2), "MB")

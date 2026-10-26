"""絵を GPT（Codex 経由・ChatGPT 契約内）に描かせて art/raw/<名前>.png に置く。
使い方: python tools/gen_art.py [名前 ...]   （なしで まだ無い物を全部）
"""
import concurrent.futures as cf
import pathlib, re, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / 'art' / 'raw'
GEN = pathlib.Path.home() / '.codex' / 'generated_images'
STYLE = ('Style exactly like the reference image: black brush-pen lines with light soft watercolor, gentle, calm and kind, '
         'never scary, never childish-cartoonish, suitable for both children and adults. Plain pure white background. '
         'No text, no letters, no numbers anywhere.')
# こども・おとな どちらでも つかえる 人物
PERSON = ('a gender-neutral young person whose age is ambiguous (could be a teenager or a young adult), short dark hair, '
          'plain light-green T-shirt and navy pants, simple and kind')
STEPS = ('Draw ONE image: 6 separate vignette illustrations in a 2-column x 3-row grid, each vignette a rounded rectangle '
         'with its own soft pale background, wide pure white gutters between them, all the same size. Show clearly what to do in '
         'each step, close-up when hands matter. When a person appears it is ' + PERSON + '. '
         'Panels in order (left to right, top to bottom): {p} ' + STYLE)
ICONS = ('Draw ONE image: a {g} grid of {n} small separate icons, each a simple single object or scene centered in its cell, '
         'wide pure white gutters, no borders, no frames. Thick soft black brush-pen outline with light watercolor fill, '
         'simple, instantly recognizable. Icons in order (left to right, top to bottom): {p} ' + STYLE)
TILE = ('Draw ONE square illustration (1:1) for a menu button of a calm support app: a soft watercolor vignette that fades '
        'into a plain warm cream (#fbf6ec) background at the edges, no hard border, no frame, no text. Black brush-pen lines with '
        'soft watercolor, high quality picture-book art, the subject large and centered. Subject: ')

JOBS = {
    'app_icon': ('ref', 'Draw ONE square app icon illustration (1024x1024), filling the whole square edge to edge: a soft sage-green background; '
        'in the center the dog from the reference (miniature schnauzer, salt-and-pepper coat, mint bandana) with a big friendly face, '
        'gently holding up a cream picture card with a simple red heart on it in its front paws. Bold clear shapes and strong dark outlines '
        'so it is recognizable at very small sizes on a phone home screen. Black brush-pen lines with soft watercolor. No text, no letters, no border.'),
    'hero': ('ref', 'Draw ONE wide illustration (16:9) for the top of a calm support app title screen: a gentle watercolor scene of a quiet '
        'town street corner with soft trees and a small park bench in morning light. In the center foreground the dog from the reference '
        '(miniature schnauzer, salt-and-pepper, mint bandana) walks happily next to ' + PERSON + ' who smiles and holds a smartphone. '
        'Leave the upper third mostly empty pale sky. The bottom edge fades softly into warm cream (#fbf6ec). No text. '
        'Black brush-pen lines with soft watercolor, premium picture-book quality, suitable for both children and adults.'),
    'tile_tsutaeru': ('ref', TILE + 'a hand holding up a large picture card with a simple drawn glass of water, and a soft speech bubble shape with a heart, the dog from the reference sitting beside it attentively.'),
    'tile_tejun': ('ref', TILE + 'a neat row of daily-life items: a toothbrush in a cup, a bar of soap with bubbles, folded clothes, and a small medicine case with a calendar checklist, the dog from the reference sitting beside them.'),
    'tile_timer': ('ref', TILE + 'a big round friendly kitchen timer with a soft green pie segment, and a small hourglass, the dog from the reference looking at the timer calmly.'),
    'tile_okane': ('ref', TILE + 'a small coin purse with a few plain round coins (no markings) and a shopping basket with an apple and bread, the dog from the reference beside them.'),
    'tile_anzen': ('ref', TILE + 'a friendly shop staff member with a name badge bending down kindly to talk to ' + PERSON + ', the dog from the reference beside them, soft daylight.'),
    'icons_body': ('ref', ICONS.format(g='4x3', n=12, p='a head (the top of a head, simple), an eye, an ear, a mouth showing teeth, a throat/neck, a chest (upper body torso), '
        'a belly (tummy area of a torso), a back (torso seen from behind), an arm, a hand, a leg, a foot. Each as a simple body part drawing of '
        'a neutral person with soft skin tone, no blood, no injuries.')),
    'icons_pain': ('ref', 'Draw ONE image: 4 separate simple round face icons in a single row (4 columns x 1 row) for a pain scale, wide pure white gutters, '
        'no text, no numbers. From left to right: 1 a calm smiling face (no pain), 2 a slightly uneasy face, 3 a hurting face with furrowed brows, '
        '4 a face in strong pain with tears (still gentle, not scary). Soft pale backgrounds in each circle: green, yellow, orange, soft red. ' + STYLE),
    'icons_want': ('ref', ICONS.format(g='4x4', n=16, p='a toilet, a glass of water, a bowl of rice with chopsticks (I want to eat), a bed with a pillow (I want to rest), '
        'a person sitting alone quietly in a corner with headphones (I want to be alone), an open door to the outside with a tree (go outside), '
        'a ball and blocks (I want to play), a house (I want to go home), '
        'a smiling face (happy), a sad face with a tear (sad), a frightened face (scared), a frustrated face with a scribble cloud (irritated), '
        'a tired sleepy face (tired), a worried face with a small question mark shape (anxious), a face covering ears with sound waves (sounds are too loud), '
        'a face squinting at a bright sun (too bright).')),
    'steps_tearai': ('ref', STEPS.format(p='1 hands under running tap water getting wet; 2 hands rubbing soap into foam; 3 rubbing palms and backs of hands together with foam; '
        '4 washing between the fingers and fingertips with foam; 5 rinsing hands under running water; 6 drying hands with a towel.')),
    'steps_hamigaki': ('ref', STEPS.format(p='1 squeezing a small pea-sized amount of toothpaste onto a toothbrush; 2 the person brushing the front teeth in front of a mirror; '
        '3 brushing the back teeth; 4 brushing the inner side of the teeth; 5 rinsing the mouth with a cup of water; 6 rinsing the toothbrush and putting it back in a cup.')),
    'steps_kigae': ('ref', STEPS.format(p='1 clothes laid out in order on a bed (underwear, shirt, pants, socks); 2 the person taking off pajamas; '
        '3 the person putting on underwear and an undershirt; 4 the person putting on a shirt, checking the front tag; 5 the person putting on pants; 6 the person putting on socks, sitting.')),
    'steps_ofuro': ('ref', STEPS.format(p='1 a clothes basket with folded clothes in a changing room; 2 the person showering their body with warm water (shown from the shoulders up, modest); '
        '3 the person washing their hair with shampoo foam; 4 the person washing their arms with a soapy towel (modest, shoulders up); 5 the person relaxing in a bathtub up to the shoulders; 6 the person drying their hair with a towel, wearing clothes.')),
    'steps_kusuri': ('ref', STEPS.format(p='1 hands being washed; 2 a glass of water and a medicine case on a table; 3 taking one dose out of a weekly pill organizer with an adult hand helping beside; '
        '4 the person drinking water with the medicine; 5 a check mark being drawn on a calendar; 6 the medicine case being put back on a shelf.')),
    'steps_maigo': ('ref', STEPS.format(p='1 the person in a shopping mall noticing they are alone, looking around; 2 the person standing still near a pillar; '
        '3 the person looking for a staff member wearing a uniform and name badge; 4 the person talking to the staff member; '
        '5 the person waiting at an information counter with the staff member; 6 the person meeting their family member again, relieved.')),
    'steps_shiranai': ('ref', STEPS.format(p='1 a stranger adult on a street offering sweets to the person; 2 the person shaking their head and saying no with a hand gesture; '
        '3 the person walking away toward a busy shop with other people; 4 the person entering a convenience store and talking to a clerk; '
        '5 the person telling their family member at home what happened; 6 the person and family member smiling together, safe at home.')),
}
REFS = {'ref': ROOT / 'art' / 'ref_molly_hello.png'}


def run(name):
    ref, prompt = JOBS[name]
    log = RAW / f'{name}.log'
    for attempt in range(2):
        with open(log, 'w', encoding='utf-8') as f:
            subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-s', 'read-only', '-i', str(REFS[ref]), '-'],
                           input='$imagegen ' + prompt + ' Save it as a PNG.', text=True, encoding='utf-8',
                           stdout=f, stderr=subprocess.STDOUT, shell=(sys.platform == 'win32'))
        text = log.read_text(encoding='utf-8', errors='replace')
        m = re.search(r'session id: (\S+)', text)
        pngs = sorted((GEN / m.group(1)).glob('*.png'), key=lambda p: p.stat().st_mtime) if m else []
        if pngs:
            for i, p in enumerate(pngs):
                shutil.copy(p, RAW / (f'{name}.png' if i == 0 else f'{name}_{i + 1}.png'))
            return f'{name}: ok ({len(pngs)})'
        if 'usage_limit' in text or 'usage limit' in text:
            return f'{name}: usage limit'
    return f'{name}: failed'


if __name__ == '__main__':
    names = sys.argv[1:] or [n for n in JOBS if not (RAW / f'{n}.png').exists()]
    with cf.ThreadPoolExecutor(3) as ex:
        for r in ex.map(run, names):
            print(r, flush=True)

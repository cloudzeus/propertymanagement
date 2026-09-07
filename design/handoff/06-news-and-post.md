# 06 — News index (`/news`) and article (`/news/[slug]`)

---

# Part A — News index

Order: Header + category chips → Featured post → Post grid → Load more → Newsletter strip → Footer.

## 1. Header

Standard inner-page header (`05 §1`). Eyebrow "Newsroom" → H1 62px `max-width:760px` "Notes on running better buildings." → lead about product releases, regulation updates and field notes.

## 2. Category chips

`flex; gap:9px; flex-wrap:wrap; margin-top:34px`. Chip `font-size:13.5px; padding:9px 16px; border-radius:999px`.
- Active: `background:#15161a; color:#fff; font-weight:700`
- Idle: `background:#fff; color:mut; border:1px solid line; font-weight:600`

Categories: **All** · Product · Regulation · Field notes · Company. Default All. Filtering is client-side over the post list; in Next.js prefer `/news?category=product` with a server filter so the state is shareable.

## 3. Featured post

One card, `grid-template-columns:1.08fr .92fr; border-radius:22px; overflow:hidden; margin-top:48px; cursor:pointer`. Hover `translateY(-3px)` + `0 34px 66px -38px rgba(27,28,26,.4)`. Stacks at ≤980px.

- **Media** (left): `position:relative; min-height:380px`, placeholder fills. No scrim needed — no text sits on it.
- **Body** (right): `padding:44px 46px; flex; flex-direction:column; justify-content:center`. Amber tag → H2 **33px** (`margin:20px 0 14px`) → excerpt 16px muted `line-height:1.62` → meta row (author · date · read time) `margin-top:18px` → small ghost button "Read the story" `margin-top:26px`.

Current featured: *"Reserve funds, explained: how much should a building actually hold?"* — Product, Eleni Markou, 12 July 2026, 8 min read.

## 4. Post grid

`repeat(3,1fr)`, `gap:20px`, `margin-top:24px` (2 columns ≤980px, 1 ≤560px).

Card: white surface, `border-radius:18px; overflow:hidden; cursor:pointer; display:flex; flex-direction:column`. Hover `translateY(-4px)` + `0 30px 58px -34px rgba(27,28,26,.42)`.

- Media `height:186px`, placeholder fills
- Body `padding:22px 24px 26px; flex:1; display:flex; flex-direction:column`: quiet small tag → title 17.5px/700 `line-height:1.3` (`margin:14px 0 9px`) → excerpt 14px muted `line-height:1.58` with `flex:1` → meta row (date · read time)

Cards enter with the scroll reveal.

### Six posts

| Category | Title | Date | Read |
|---|---|---|---|
| Product | Split by share, area or your own rule — expense allocation gets an upgrade | 4 July 2026 | 5 min |
| Regulation | What the 2026 building energy audit means for managers | 28 June 2026 | 6 min |
| Field notes | How one manager cut ticket resolution from 11 days to 4 hours | 19 June 2026 | 7 min |
| Product | The resident app now works fully offline | 11 June 2026 | 3 min |
| Company | Orithon raises a seed round to expand across Southern Europe | 2 June 2026 | 4 min |
| Field notes | Nine ways buildings lose money without anyone noticing | 24 May 2026 | 9 min |

Excerpts are in the reference file. Model each post as `{ slug, category, title, excerpt, date, readMinutes, author, image }` in `lib/posts.ts`.

## 5. Load more

Centred ghost button "Load more articles", `margin-top:44px`. Wire to pagination or an infinite scroll — the prototype does not implement it.

## 6. Newsletter strip

Dark panel: `background:#15161a; color:#fff; border-radius:22px; padding:44px 46px; margin-top:60px`, `flex; align-items:center; justify-content:space-between; gap:34px; flex-wrap:wrap`.

Left: H3 white "The monthly building brief" + `rgba(255,255,255,.6)` 14.5px paragraph `max-width:420px; margin-top:12px`.
Right: `flex; gap:9px; flex-wrap:wrap` — dark-panel email input (`min-width:250px`, `02 §6`) + amber submit "Subscribe".

Add real validation, a pending state and a success message; the prototype has none.

---

# Part B — Article detail

Order: Reading progress → Header → Hero image + caption → Prose body → Share → Author bio → Related band → Footer.

## 1. Reading progress

Fixed 3px amber bar at the very top, `z-index:80` (`02 §1`).

## 2. Header

Header pattern with `padding-bottom:0`, inside the **760px narrow** container.

1. Breadcrumb `font-size:13px; color:mut2; flex; gap:8px; margin-bottom:26px` — `News › Product`, the first item a link
2. Amber tag
3. H1 **52px** `margin-top:20px`
4. Standfirst — the lead style, but `max-width:100%`
5. Author row `margin-top:30px`, `flex; gap:13px; align-items:center`: 46px avatar + name 14.5px/700 + `date · read time` 12.5px muted

## 3. Hero image

Wider than the text: a **1000px** container. `border-radius:22px; overflow:hidden; height:440px; border:1px solid line; margin-top:44px`. Caption below: 12.5px `mut2`, centred, italic, `margin-top:12px`.

## 4. Prose

Column `max-width:720px` centred inside the 760px container, section `padding:56px 0 20px`.

```
font-size:18px; line-height:1.75; color:#33342f;
p            margin-bottom:26px
h2           29px/800, −0.02em, color:txt, margin:48px 0 18px, line-height:1.2
ul           list-style:none; padding:0; margin-bottom:28px; flex column; gap:13px
ul li        flex; gap:13px; align-items:flex-start; font-size:17px; line-height:1.6
ul li marker amber, font-weight:800 — "›" in body lists, "✓" in the takeaway box
```

**Drop cap** on the first paragraph only:

```css
.dropcap::first-letter {
  font-family: 'ACaslon', serif;
  font-size: 66px; float: left; line-height: .82;
  padding: 6px 12px 0 0; color: #F2A23C;
}
```

**Pull quote** — `border-left:3px solid #F2A23C; padding:6px 0 6px 28px; margin:40px 0; font-size:25px; font-weight:600; line-height:1.42; −0.012em; color:txt`. No quotation marks; the rule does the work.

**Takeaway box** — `background:paper; border:1px solid line; border-radius:18px; padding:30px 32px; margin:44px 0`. Label "Key takeaways" 12px/800 uppercase `letter-spacing:.12em` `mut2` `margin-bottom:18px`, then an amber-`✓` list.

### Body structure

The article is authored as fixed slots so it can be translated cleanly: `p1` (drop cap) · `p2` · pull quote · `h2a` · `p3` · 4-item bullet list · `h2b` · `p4` · takeaway box (3 items) · `p5`.

In Next.js, MDX is the better long-term home — but keep this block sequence and the component set (`PullQuote`, `TakeawayBox`) so translated articles stay structurally identical.

Current article: *"Reserve funds, explained: how much should a building actually hold?"* — an analysis of two years of collections across 200 buildings concluding that three months of average expenses in a separate account, paired with a written maintenance schedule, covers 96% of unplanned events. Full text (EN + GR) in the reference file.

## 5. Share row

`flex; align-items:center; gap:11px; padding:28px 0; border-top/bottom:1px solid line2; margin:48px 0; font-size:13.5px; color:mut`.

Label "Share this article", then four 38px square buttons — `border-radius:10px; background:#fff; border:1px solid line; font-size:12px; font-weight:700`. Hover: `background:#15161a; color:#fff; border-color:#15161a; translateY(-2px)`. Glyphs `in` / `X` / `f` / `✉` — replace with proper icons and real share URLs.

## 6. Author bio

White card, `border-radius:18px; padding:28px 30px`, `flex; gap:20px; align-items:flex-start`. 62px avatar, then name 16.5px/800, role 13px muted (`margin-top:3px`), bio 14px muted `line-height:1.6` (`margin-top:12px`).

## 7. Related band

`alt` band section, `margin-top:60px`.

Head row: `flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap; margin-bottom:32px` — left kicker "Keep reading" + H2 "Related articles"; right small ghost button "All articles" → `/news`.

Then three post cards, identical to the index grid. Pick related by shared category, excluding the current article.

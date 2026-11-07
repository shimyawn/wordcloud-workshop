# Word cloud workshop

Open this folder in VS Code and start Live Server here, so the presentation can load the word clouds and read their code.

| Folder | What it is |
| --- | --- |
| `presentation/` | Our presentation. ← → move · 0–7 jump · N notes · T timer · F full screen · G glossary |
| `Wordcloud_clean/` | Our word cloud: one classic cloud per source, size = sentences, colour = tone. Six functions in `wordcloud.js` |
| `Wordcloud_task1/` | Task 1 result: top 10 / 50 / 100 / 1000 by count, with the tie note |
| `Wordcloud_task2/` | Task 2 result: words lean by share of praise (`drift`), with an axis and a drift slider |
| `student-guide/` | The student guide (EN / 中文). No code, no finished cloud, no complete prompts |

## Before presenting
- Set `STUDENT_SITE_URL` at the top of `presentation/present.js`.
- The code slides read `Wordcloud_clean/wordcloud.js` and `index.html` live and cut them at the `// STEP n` comments.
- The deck needs internet for the D3 CDN.

## Console checkpoints (base)
- [Step 1] 3000 sentences
- [Step 2] food, not good
- [Step 3] Dining: good 69/9 84% · great 64/0 93% · food 59/61 49% · not good 0/13 22% · bad 0/16 19%
- [Step 4] kept Dining 164 · Film 186 · Tech 153 | left out 1838 / 2810 / 1620
- [Step 5] unplaced 0 in every cloud
- [Step 6] 503 words drawn

Data: Sentiment Labelled Sentences, Kotzias et al., KDD 2015 (UCI Machine Learning Repository, CC BY 4.0).

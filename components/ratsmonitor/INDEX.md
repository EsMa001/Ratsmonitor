# Frontend-Index (erzeugt, nicht von Hand ändern)

Neu erzeugen: `node scripts/frontend-index.mjs`. Ergänzt `FRONTEND.md` (Wo ist was?) um Dateien, Exporte und CSS-Klassen mit Zeilennummer.
`⚠N` = N Zeilen über 300 Zeichen: dort nicht ganze Zeilen lesen, sondern mit `grep -o` oder `grep -n` gezielt suchen.

## CSS-Klassen (Klasse Datei:Zeile)

- app/admin.css (497 Zeilen, ⚠11)
- app/analyse-admin.css (59 Zeilen, ⚠6)
- app/design-styles.css (254 Zeilen)
- app/design-tokens.css (75 Zeilen)
- app/globals.css (15 Zeilen, ⚠2)
- app/ratsmonitor-info.css (578 Zeilen, ⚠14)
- app/ratsmonitor.css (616 Zeilen, ⚠38)

absolute ratsmonitor.css:611
admin-access admin.css:6
admin-activation admin.css:6
admin-ai-kinds admin.css:10
admin-ai-local admin.css:431
admin-ai-local-article admin.css:455
admin-ai-local-completed admin.css:459
admin-ai-local-count admin.css:442
admin-ai-local-details admin.css:462
admin-ai-local-empty admin.css:468
admin-ai-local-error admin.css:471
admin-ai-local-feedback admin.css:469
admin-ai-local-filters admin.css:436
admin-ai-local-icon admin.css:439
admin-ai-local-legacy admin.css:473
admin-ai-local-list admin.css:443
admin-ai-local-outputs admin.css:433
admin-ai-local-pagination admin.css:465
admin-ai-local-select admin.css:449
admin-ai-local-spin admin.css:478
admin-ai-local-table admin.css:445
admin-ai-local-toolbar admin.css:437
admin-ai-local-tools admin.css:438
admin-ai-preview admin.css:220
admin-ai-retry admin.css:10
admin-app admin.css:13
admin-app ratsmonitor.css:211
admin-atlas-block admin.css:99
admin-atlas-canvas admin.css:72
admin-atlas-chips admin.css:56
admin-atlas-close admin.css:92
admin-atlas-detail admin.css:89
admin-atlas-detail-head admin.css:90
admin-atlas-dot admin.css:84
admin-atlas-facts admin.css:95
admin-atlas-flag admin.css:88
admin-atlas-list admin.css:76
admin-atlas-main admin.css:63
admin-atlas-map admin.css:65
admin-atlas-meta admin.css:87
admin-atlas-name admin.css:85
admin-atlas-pop admin.css:86
admin-atlas-reason admin.css:75
admin-atlas-row admin.css:80
admin-atlas-rows admin.css:79
admin-atlas-stack admin.css:53
admin-atlas-tools admin.css:66
admin-atlas-why admin.css:50
admin-attention admin.css:141
admin-bar admin.css:6
admin-bar-row admin.css:6
admin-charts admin.css:6
admin-chip admin.css:57
admin-empty admin.css:6
admin-estimate admin.css:141
admin-estimate analyse-admin.css:46
admin-estimate-action admin.css:214
admin-estimate-action analyse-admin.css:46
admin-estimate-assumptions analyse-admin.css:46
admin-estimate-basis admin.css:209
admin-estimate-basis analyse-admin.css:46
admin-estimate-charts analyse-admin.css:47
admin-estimate-class analyse-admin.css:46
admin-estimate-explain analyse-admin.css:49
admin-estimate-facts admin.css:200
admin-estimate-facts analyse-admin.css:49
admin-estimate-figure analyse-admin.css:47
admin-estimate-formula analyse-admin.css:47
admin-estimate-key admin.css:205
admin-estimate-key analyse-admin.css:47
admin-estimate-share analyse-admin.css:47
admin-estimate-step analyse-admin.css:47
admin-estimate-subheading analyse-admin.css:46
admin-estimate-table analyse-admin.css:46
admin-estimate-tag admin.css:196
admin-estimate-tag analyse-admin.css:49
admin-estimate-tags admin.css:214
admin-estimate-tags analyse-admin.css:49
admin-estimate-wrap analyse-admin.css:47
admin-gate admin.css:6
admin-gate analyse-admin.css:58
admin-geography admin.css:10
admin-job admin.css:10
admin-job-counts admin.css:14
admin-job-progress admin.css:13
admin-job-results admin.css:10
admin-kpi admin.css:7
admin-lands admin.css:32
admin-legacy admin.css:105
admin-list-meta admin.css:10
admin-map admin.css:10
admin-map-canvas admin.css:10
admin-map-hover admin.css:10
admin-map-region admin.css:10
admin-mono admin.css:100
admin-nav admin.css:6
admin-next admin.css:42
admin-next-link admin.css:43
admin-note admin.css:6
admin-notice admin.css:6
admin-notice ratsmonitor.css:211
admin-number admin.css:6
admin-operations admin.css:6
admin-overview-charts admin.css:22
admin-overview-trend admin.css:29
admin-pill admin.css:93
admin-pipeline admin.css:10
admin-quality-checks admin.css:118
admin-quality-group admin.css:116
admin-quality-head admin.css:120
admin-quality-samples admin.css:128
admin-refresh admin.css:6
admin-region-list admin.css:10
admin-review-head admin.css:6
admin-review-list admin.css:6
admin-run-debug analyse-admin.css:51
admin-run-debug-actions analyse-admin.css:51
admin-run-debug-panel admin.css:169
admin-run-debug-panel analyse-admin.css:51
admin-run-debug-requests analyse-admin.css:51
admin-section admin.css:6
admin-section-heading admin.css:6
admin-section-heading analyse-admin.css:53
admin-seg admin.css:67
admin-selection-actions admin.css:10
admin-share admin.css:39
admin-source-controls admin.css:6
admin-source-item admin.css:10
admin-source-list admin.css:10
admin-source-meta admin.css:10
admin-stage admin.css:10
admin-stage-ai admin.css:10
admin-stage-grid admin.css:10
admin-stage-grid-local admin.css:430
admin-stage-number admin.css:10
admin-state admin.css:6
admin-status-row admin.css:6
admin-storage-status admin.css:10
admin-table admin.css:6
admin-territories admin.css:10
admin-timeline admin.css:141
admin-timeline analyse-admin.css:44
admin-timeline-charts analyse-admin.css:44
admin-timeline-controls analyse-admin.css:44
admin-timeline-table admin.css:29
admin-timeline-table analyse-admin.css:44
admin-todo admin.css:224
admin-todo-avatar admin.css:304
admin-todo-backlog-rows admin.css:321
admin-todo-board admin.css:394
admin-todo-card admin.css:279
admin-todo-card-actions admin.css:307
admin-todo-card-owner admin.css:299
admin-todo-card-top admin.css:283
admin-todo-category admin.css:313
admin-todo-category-empty admin.css:330
admin-todo-category-head admin.css:314
admin-todo-cell admin.css:276
admin-todo-cell-empty admin.css:278
admin-todo-choice admin.css:250
admin-todo-column-heading admin.css:269
admin-todo-columns admin.css:267
admin-todo-conflicts admin.css:336
admin-todo-dialog admin.css:343
admin-todo-dialog-actions admin.css:365
admin-todo-dialog-description admin.css:346
admin-todo-dialog-head admin.css:344
admin-todo-empty admin.css:311
admin-todo-error admin.css:332
admin-todo-error-actions admin.css:335
admin-todo-field admin.css:348
admin-todo-field--wide admin.css:350
admin-todo-filters admin.css:246
admin-todo-form admin.css:347
admin-todo-head admin.css:231
admin-todo-head-actions admin.css:236
admin-todo-icon admin.css:238
admin-todo-lane admin.css:272
admin-todo-lane-columns admin.css:267
admin-todo-lane-heading admin.css:273
admin-todo-loading admin.css:341
admin-todo-menu admin.css:254
admin-todo-meta admin.css:288
admin-todo-mobile-status admin.css:367
admin-todo-order admin.css:309
admin-todo-overdue admin.css:295
admin-todo-overlay admin.css:342
admin-todo-owner admin.css:300
admin-todo-person admin.css:302
admin-todo-plan admin.css:329
admin-todo-primary admin.css:241
admin-todo-priority admin.css:290
admin-todo-priority-choice admin.css:292
admin-todo-resolution admin.css:294
admin-todo-row admin.css:323
admin-todo-row-description admin.css:326
admin-todo-row-main admin.css:324
admin-todo-row-owner admin.css:327
admin-todo-row-status admin.css:327
admin-todo-save-state admin.css:237
admin-todo-search admin.css:247
admin-todo-spin admin.css:368
admin-todo-status-choice admin.css:308
admin-todo-subtask-add admin.css:364
admin-todo-subtask-check admin.css:360
admin-todo-subtasks admin.css:355
admin-todo-summary admin.css:225
admin-todo-swimlane admin.css:265
admin-todo-tabs admin.css:232
admin-todo-task-title admin.css:286
admin-todo-text-action admin.css:243
admin-todo-view-tools admin.css:264
admin-todo-wait-filter admin.css:262
admin-todo-waiting admin.css:296
admin-todo-wip admin.css:275
admin-zoom admin.css:70
animate-pulse ratsmonitor-info.css:554
animate-spin ratsmonitor-info.css:554
back-btn ratsmonitor-info.css:427
back-btn ratsmonitor.css:23
bg-slate-900 ratsmonitor.css:180
bg-teal-50 ratsmonitor.css:102
bg-teal-600 ratsmonitor.css:212
bg-teal-700 ratsmonitor.css:176
bg-white ratsmonitor.css:199
border-slate-100 ratsmonitor.css:164
bottom-3 ratsmonitor.css:411
btn-danger ratsmonitor.css:17
btn-primary admin.css:161
btn-primary ratsmonitor.css:8
btn-secondary admin.css:161
btn-secondary ratsmonitor.css:11
btn-sm admin.css:215
btn-sm ratsmonitor.css:14
button design-styles.css:58
button--primary design-styles.css:69
card-shell ratsmonitor.css:46
docs design-styles.css:207
eyebrow admin.css:6
eyebrow analyse-admin.css:14
facts design-styles.css:192
facts__row design-styles.css:193
field-help ratsmonitor.css:34
field-input ratsmonitor.css:28
field-label ratsmonitor.css:31
figure design-styles.css:197
fixed ratsmonitor.css:612
font-bold ratsmonitor.css:66
font-medium ratsmonitor.css:68
font-semibold ratsmonitor.css:67
gap-10 ratsmonitor-info.css:357
gap-6 ratsmonitor-info.css:392
gap-8 ratsmonitor-info.css:391
gap-y-12 ratsmonitor-info.css:346
gap-y-6 ratsmonitor-info.css:389
gap-y-8 ratsmonitor-info.css:347
grid ratsmonitor-info.css:477
grid ratsmonitor.css:377
group ratsmonitor.css:167
h-16 ratsmonitor-info.css:367
heading-m design-styles.css:44
hidden ratsmonitor.css:327
hover ratsmonitor.css:180
icon design-styles.css:22
inset-x-16 ratsmonitor.css:312
is-assumed admin.css:196
is-assumed analyse-admin.css:46
is-clean admin.css:121
is-collapsed admin.css:318
is-counted admin.css:196
is-counted analyse-admin.css:49
is-data admin.css:41
is-done admin.css:331
is-dragging admin.css:281
is-drop-before admin.css:282
is-drop-target admin.css:277
is-error admin.css:470
is-failed analyse-admin.css:51
is-found admin.css:120
is-group admin.css:62
is-high admin.css:291
is-line analyse-admin.css:49
is-max admin.css:305
is-model admin.css:196
is-model analyse-admin.css:47
is-nico admin.css:306
is-open analyse-admin.css:53
is-sample admin.css:205
is-sample analyse-admin.css:47
is-selected admin.css:10
is-static admin.css:111
is-stored analyse-admin.css:47
left-3 ratsmonitor.css:379
legend design-styles.css:251
link-btn ratsmonitor.css:20
map-canvas analyse-admin.css:33
mb-6 ratsmonitor-info.css:359
mb-8 ratsmonitor-info.css:379
min-w-0 ratsmonitor.css:306
monthly-mix analyse-admin.css:23
mt-10 ratsmonitor-info.css:382
mt-12 ratsmonitor-info.css:381
mt-16 ratsmonitor-info.css:380
mt-3 ratsmonitor-info.css:363
mt-4 ratsmonitor-info.css:362
mt-5 ratsmonitor-info.css:349
mt-6 ratsmonitor-info.css:360
mt-8 ratsmonitor-info.css:383
needs-attention admin.css:6
notice design-styles.css:245
page design-styles.css:34
page-error-action analyse-admin.css:55
page-note design-styles.css:36
page-note ratsmonitor.css:61
pb-10 ratsmonitor-info.css:378
pl-band ratsmonitor-info.css:409
pl-band ratsmonitor.css:326
pl-cta ratsmonitor-info.css:332
pl-ctawrap ratsmonitor-info.css:401
pl-cut3 ratsmonitor-info.css:450
pl-footer-accent ratsmonitor-info.css:323
pl-grid ratsmonitor-info.css:401
pl-h1 ratsmonitor-info.css:401
pl-h2 ratsmonitor-info.css:401
pl-hero ratsmonitor-info.css:401
pl-left ratsmonitor-info.css:401
pl-mapwrap ratsmonitor-info.css:401
pl-num ratsmonitor-info.css:401
pl-opt ratsmonitor-info.css:403
pl-ort ratsmonitor-info.css:401
pl-ping ratsmonitor-info.css:400
pl-pop ratsmonitor-info.css:400
pl-pulse ratsmonitor-info.css:402
pl-search ratsmonitor-info.css:401
pl-slogan ratsmonitor-info.css:401
pl-source ratsmonitor-info.css:401
pl-stand ratsmonitor-info.css:401
pl-still ratsmonitor-info.css:401
pl-top ratsmonitor-info.css:474
pl-tp ratsmonitor-info.css:399
pl-trends ratsmonitor-info.css:401
popover ratsmonitor.css:52
process design-styles.css:119
process__bar design-styles.css:121
process__label design-styles.css:123
process__step design-styles.css:120
process__step--open design-styles.css:122
prose analyse-admin.css:8
prose design-styles.css:201
prose ratsmonitor.css:61
py-10 ratsmonitor-info.css:395
py-2 ratsmonitor-info.css:365
py-3 ratsmonitor-info.css:364
py-6 ratsmonitor-info.css:366
ratsmonitor ratsmonitor-info.css:197
ratsmonitor ratsmonitor.css:5
relative ratsmonitor.css:306
ri ratsmonitor-info.css:13
ri ratsmonitor.css:157
ri-actions ratsmonitor-info.css:29
ri-anw ratsmonitor-info.css:336
ri-below ratsmonitor-info.css:456
ri-below__h ratsmonitor-info.css:457
ri-below__lead ratsmonitor-info.css:458
ri-bid ratsmonitor-info.css:35
ri-bid__icon ratsmonitor-info.css:36
ri-bid__label ratsmonitor-info.css:37
ri-bid__name ratsmonitor-info.css:38
ri-bid__name ratsmonitor.css:155
ri-btn ratsmonitor-info.css:21
ri-btn--block ratsmonitor-info.css:28
ri-btn--dark ratsmonitor-info.css:22
ri-btn--dark ratsmonitor.css:172
ri-btn--inv ratsmonitor-info.css:26
ri-btn--inv ratsmonitor.css:162
ri-btn--light ratsmonitor-info.css:24
ri-burger ratsmonitor-info.css:194
ri-check ratsmonitor-info.css:171
ri-dark ratsmonitor-info.css:86
ri-dark ratsmonitor.css:158
ri-dark__row ratsmonitor-info.css:87
ri-dark__sub ratsmonitor-info.css:89
ri-dark__sub ratsmonitor.css:161
ri-err ratsmonitor-info.css:170
ri-faq-group ratsmonitor-info.css:121
ri-faq-group__label ratsmonitor-info.css:122
ri-faq-list ratsmonitor-info.css:123
ri-faq-list--top ratsmonitor-info.css:124
ri-field ratsmonitor-info.css:161
ri-for ratsmonitor-info.css:42
ri-form ratsmonitor-info.css:159
ri-form--center ratsmonitor-info.css:160
ri-form__foot ratsmonitor-info.css:176
ri-h1 ratsmonitor-info.css:39
ri-h1 ratsmonitor.css:155
ri-h1--sm ratsmonitor-info.css:40
ri-h2 ratsmonitor-info.css:48
ri-h2 ratsmonitor.css:155
ri-h2--gap ratsmonitor-info.css:149
ri-h2--md ratsmonitor-info.css:49
ri-head ratsmonitor-info.css:32
ri-head ratsmonitor.css:182
ri-head--compact ratsmonitor-info.css:260
ri-head__grid ratsmonitor-info.css:33
ri-head__grid--top ratsmonitor-info.css:34
ri-help ratsmonitor-info.css:169
ri-input ratsmonitor-info.css:163
ri-konto ratsmonitor-info.css:355
ri-lead ratsmonitor-info.css:41
ri-link ratsmonitor-info.css:173
ri-menu ratsmonitor-info.css:13
ri-menu ratsmonitor.css:131
ri-menu__bg ratsmonitor-info.css:199
ri-menu__chev ratsmonitor-info.css:284
ri-menu__group ratsmonitor-info.css:282
ri-menu__main ratsmonitor-info.css:208
ri-menu__nav ratsmonitor-info.css:206
ri-menu__panel ratsmonitor-info.css:17
ri-menu__panel--flyout ratsmonitor-info.css:302
ri-menu__start ratsmonitor-info.css:271
ri-menu__sub ratsmonitor-info.css:212
ri-menu__subs ratsmonitor-info.css:211
ri-pill ratsmonitor-info.css:91
ri-pills ratsmonitor-info.css:90
ri-place ratsmonitor-info.css:107
ri-point ratsmonitor-info.css:115
ri-point__num ratsmonitor-info.css:116
ri-points ratsmonitor-info.css:114
ri-points--2 ratsmonitor-info.css:273
ri-pv ratsmonitor-info.css:98
ri-pv__card ratsmonitor-info.css:103
ri-pv__topics ratsmonitor-info.css:104
ri-pv__topics-label ratsmonitor-info.css:105
ri-qa ratsmonitor-info.css:125
ri-qa__a ratsmonitor-info.css:132
ri-qa__a--todo ratsmonitor-info.css:133
ri-qa__sign ratsmonitor-info.css:129
ri-qa__sign--minus ratsmonitor-info.css:130
ri-qa__sign--plus ratsmonitor-info.css:130
ri-sec ratsmonitor-info.css:45
ri-sec--faq ratsmonitor-info.css:47
ri-sec--prices ratsmonitor-info.css:146
ri-sec--tight ratsmonitor-info.css:46
ri-sub ratsmonitor-info.css:50
ri-submit ratsmonitor-info.css:175
ri-table ratsmonitor-info.css:150
ri-table__first ratsmonitor-info.css:156
ri-tl ratsmonitor-info.css:62
ri-tl__icon ratsmonitor-info.css:65
ri-tl__label ratsmonitor-info.css:67
ri-tl__step ratsmonitor-info.css:64
ri-tl__step--out ratsmonitor-info.css:66
ri-tl__title ratsmonitor-info.css:69
ri-tl__title ratsmonitor.css:155
ri-toc ratsmonitor-info.css:565
ri-topnav ratsmonitor-info.css:297
right-3 ratsmonitor.css:314
rm-analytics ratsmonitor-info.css:378
rm-art-std ratsmonitor.css:285
rm-attr ratsmonitor.css:253
rm-band-mid ratsmonitor-info.css:444
rm-band-mid ratsmonitor.css:330
rm-banddots ratsmonitor-info.css:440
rm-bandicon ratsmonitor-info.css:435
rm-bar ratsmonitor.css:561
rm-brandtag ratsmonitor-info.css:432
rm-chip ratsmonitor.css:92
rm-dark admin.css:461
rm-dark ratsmonitor-info.css:327
rm-dark ratsmonitor.css:88
rm-deskbar ratsmonitor.css:346
rm-dialog ratsmonitor.css:575
rm-dotfield ratsmonitor-info.css:405
rm-dotfield-on ratsmonitor-info.css:406
rm-dots ratsmonitor.css:117
rm-draw ratsmonitor.css:557
rm-flat ratsmonitor.css:74
rm-focusrows ratsmonitor.css:562
rm-footcta ratsmonitor.css:506
rm-fpop ratsmonitor.css:455
rm-gflow ratsmonitor.css:546
rm-gin ratsmonitor.css:543
rm-glass ratsmonitor.css:83
rm-glass-pop ratsmonitor.css:91
rm-gpulse ratsmonitor.css:544
rm-gpulse2 ratsmonitor.css:545
rm-gtext ratsmonitor.css:188
rm-headtitle ratsmonitor-info.css:497
rm-karte-toggle ratsmonitor.css:285
rm-legalbar ratsmonitor.css:261
rm-legend ratsmonitor.css:87
rm-liquid ratsmonitor.css:412
rm-logo ratsmonitor-info.css:186
rm-logo ratsmonitor.css:154
rm-logo--big ratsmonitor-info.css:307
rm-logo__mark ratsmonitor-info.css:190
rm-logo__mark--p ratsmonitor-info.css:191
rm-logo__text ratsmonitor-info.css:188
rm-mapbox ratsmonitor.css:273
rm-mapctl ratsmonitor.css:253
rm-mapwrap ratsmonitor.css:271
rm-netstage ratsmonitor.css:397
rm-noplay ratsmonitor.css:283
rm-pagein ratsmonitor.css:572
rm-pmark ratsmonitor-info.css:499
rm-rail-open ratsmonitor.css:389
rm-rail-sub ratsmonitor.css:287
rm-sbar ratsmonitor.css:246
rm-schritt-std ratsmonitor.css:293
rm-search ratsmonitor-info.css:316
rm-search ratsmonitor.css:235
rm-sec ratsmonitor.css:588
rm-sec-m ratsmonitor.css:588
rm-sec-s ratsmonitor.css:588
rm-solid ratsmonitor.css:91
rm-spinner ratsmonitor-info.css:554
rm-spinner ratsmonitor.css:114
rm-stage ratsmonitor-info.css:478
rm-stage-chip ratsmonitor.css:398
rm-statusstrip ratsmonitor.css:492
rm-step ratsmonitor.css:567
rm-sub-std ratsmonitor.css:381
rm-sub-wide ratsmonitor.css:381
rm-tabbar ratsmonitor.css:224
rm-topline ratsmonitor.css:182
rm-wheel-list ratsmonitor.css:468
rm-xbtn ratsmonitor.css:517
rm-xebene ratsmonitor.css:291
rm-xfield ratsmonitor.css:517
rm-xfilter ratsmonitor.css:284
rm-xhandle ratsmonitor.css:496
rm-xhero ratsmonitor.css:369
rm-xhero-panel ratsmonitor.css:369
rm-xlegend ratsmonitor.css:449
rm-xnet ratsmonitor.css:283
rm-xrail ratsmonitor.css:286
rm-xschritt ratsmonitor.css:358
rm-xsearch ratsmonitor.css:283
rm-xseg ratsmonitor.css:393
rm-xsplit ratsmonitor.css:267
rm-xsplit--solo ratsmonitor.css:268
rm-xsplit-map ratsmonitor.css:270
rm-xstage ratsmonitor.css:393
rm-xtop ratsmonitor.css:315
rm-xwide ratsmonitor.css:280
rm-xzeit ratsmonitor.css:294
rm-zeit-std ratsmonitor.css:293
scroll-thin ratsmonitor.css:55
section design-styles.css:249
section-title design-styles.css:39
select-active ratsmonitor.css:41
select-base admin.css:460
select-base ratsmonitor.css:38
session design-styles.css:159
session-details analyse-admin.css:37
sessions design-styles.css:158
setting design-styles.css:211
setting__hint design-styles.css:214
setting__label design-styles.css:212
setting__name design-styles.css:213
share-button design-styles.css:82
skip-link analyse-admin.css:6
skip-link ratsmonitor.css:131
space-y-6 ratsmonitor-info.css:348
space-y-8 ratsmonitor-info.css:393
steps design-styles.css:114
steps__bar design-styles.css:115
steps__bar--done design-styles.css:116
sticky ratsmonitor.css:152
switch design-styles.css:217
tabs analyse-admin.css:7
tabs design-styles.css:135
tag analyse-admin.css:7
tag design-styles.css:99
text-link admin.css:6
text-link analyse-admin.css:58
text-link design-styles.css:72
text-link ratsmonitor.css:97
text-slate-500 ratsmonitor-info.css:417
text-slate-900 ratsmonitor.css:166
text-teal-700 ratsmonitor-info.css:415
text-teal-700 ratsmonitor.css:611
text-white ratsmonitor.css:180
timeline design-styles.css:204
top-3 ratsmonitor.css:399
topic design-styles.css:140
touch-pan-y ratsmonitor.css:295
truncate ratsmonitor-info.css:460
z- ratsmonitor.css:399

## Dateien (Zeilen, Exporte)


### app/(monitor)/agb/
- page.tsx (4): metadata, Page

### app/(monitor)/analytics/[[...section]]/
- page.tsx (23, ⚠1): generateMetadata, Page

### app/(monitor)/anmelden/bestaetigen/
- page.tsx (4): metadata, Page

### app/(monitor)/anmelden/
- page.tsx (4): metadata, Page

### app/(monitor)/anwender/[slug]/
- page.tsx (16, ⚠1): generateMetadata, Page

### app/(monitor)/beschluss/[id]/
- opengraph-image.tsx (74): alt, size, contentType, Image
- page.tsx (35): generateMetadata, Page

### app/(monitor)/datenabdeckung/
- page.tsx (4): metadata, Page

### app/(monitor)/datenschutz/
- page.tsx (4): metadata, Page

### app/(monitor)/faq/
- page.tsx (4): metadata, Page

### app/(monitor)/funktionen/benachrichtigungen/
- page.tsx (4): metadata, Page

### app/(monitor)/impressum/
- page.tsx (4): metadata, Page

### app/(monitor)/kontakt/
- page.tsx (4): metadata, Page

### app/(monitor)/konto/[[...section]]/
- page.tsx (6, ⚠1): metadata, Page

### app/(monitor)/
- layout.tsx (11): MonitorLayout
- not-found.tsx (4): metadata, NotFound
- page-meta.ts (22): pageMeta, privateMeta
- page.tsx (14): metadata, Page

### app/(monitor)/preise/
- page.tsx (4): metadata, Page

### app/(monitor)/registrieren/
- page.tsx (4): Page

### app/(monitor)/suche/
- page.tsx (4): metadata, Page

### app/(monitor)/thema/[id]/
- page.tsx (8): Page

### app/(monitor)/videos/
- page.tsx (4): metadata, Page

### app/(monitor)/widerruf/
- page.tsx (4): metadata, Page

### app/admin/
- page.tsx (90, ⚠7): dynamic, metadata, AdminPage

### app/
- chatgpt-auth.ts (92): ChatGPTUser, getChatGPTUser, chatGPTSignInAvailable, chatGPTSignInPath, chatGPTSignOutPath
- error.tsx (9, ⚠1): PageError
- global-error.tsx (11, ⚠1): GlobalError
- layout.tsx (12, ⚠2): metadata, viewport, RootLayout
- not-found.tsx (4): metadata, NotFound
- robots.ts (12): robots
- site-url.ts (3): SITE_URL
- sitemap.ts (12): sitemap

### components/
- admin-activation.tsx (7, ⚠1): AdminActivation
- admin-ai-local.tsx (114, ⚠8): AdminAiLocal
- admin-altbestand.tsx (138, ⚠8): AdminAltbestand
- admin-atlas.tsx (205, ⚠29): AdminAtlas
- admin-catch-up.tsx (10): RegionCatchUp
- admin-chrome.tsx (143, ⚠1): AdminPage, AdminEntry, ADMIN_GROUPS, START_PAGE, ADMIN_PAGES, VISIBLE_PAGES, groupOf, adminHref, AdminBar, AdminFrame
- admin-cockpit.tsx (98, ⚠1): AdminCockpit
- admin-colors.ts (17): AC, HATCH_CSS, COVERAGE, shareColor, BUCKET_COLOR, bucketColor, ACCESS_COLOR
- admin-dashboard.tsx (114, ⚠7): AdminRuns, AdminReview, AdminStock
- admin-debug.tsx (144, ⚠9): AdminDebug
- admin-estimate.tsx (355, ⚠51): AdminEstimate
- admin-fehler.tsx (80, ⚠4): AdminFehler
- admin-forecast.tsx (9): AdminForecast
- admin-icons.tsx (41): IconName, Icon
- admin-loader.tsx (47): DashboardPage, AdminLoader
- admin-mobile.tsx (43, ⚠1): AdminMobile
- admin-overview.tsx (170, ⚠13): AdminOverview
- admin-pdf-parts.tsx (169, ⚠10): n, pct, gb, size, when, clock, day, month, dur, KIND, MonthRow, MonthBars, SpaceBar, ProcessFlow, Host, HostList, RunStep, Run, RunList, Quality, scorePct, QualityTable
- admin-pdf.tsx (272, ⚠20): AdminPdf
- admin-pipeline-parts.tsx (99, ⚠2): n, Step, FailRow, Glossary, stepSentence, StepList, result, Timeline, FailureTable, HostTable
- admin-processing-map.tsx (50, ⚠4): AdminProcessingMap
- admin-processing.tsx (191, ⚠19): AdminProcessing
- admin-quality-check.tsx (74, ⚠4): AdminQualityCheck
- admin-rule-texts.tsx (300, ⚠21): AdminRuleTexts
- admin-run-debug.tsx (70, ⚠2): RunDebugView, AdminRunDebug
- admin-schedules.tsx (117, ⚠4): AdminSchedules
- admin-signout.tsx (13): AdminSignOut
- admin-social.tsx (137, ⚠1): AdminSocial
- admin-source-notes.tsx (21, ⚠1): SourceNotes
- admin-stand.tsx (28): standText, StandLine
- admin-storage.tsx (127, ⚠9): AdminStorage
- admin-store.ts (98): ADMIN_REGIONS_DONE, CatchUp, useRegionCatchUp, setAdminStaticVersion, fetchDashboard
- admin-texts.ts (399, ⚠4): href, Todo, Help, PAGE_HEAD, FOOT, ZUSTAND, JOB_STATE_HELP, HELP, TERMS, FILTER_HELP, MAP_HELP, STATE_HELP, ATLAS_TODO, REVIEW_HELP, FIELD_HELP, FIELD_FOOT, QUALITY_EXPLAIN, QUALITY_FIGURE_HELP, QUALITY_TEXT, COL_HELP, PROTOKOLL, TITLES, HOCHRECHNUNG
- admin-timeline.tsx (88, ⚠4): AdminTimeline
- admin-todo.tsx (11): AdminTodo
- admin-totp.tsx (62): AdminTotp, AdminTotpSetup
- admin-ui.tsx (87): dd, mm, short, AdminPageHead, Kpi, Kpis, How, SectionHelp, SectionTodo, Skeleton, PageSkeleton, Legend, Alert, AdminChoice, AdminAreaPick
- admin-verarbeitung.tsx (77, ⚠3): AdminVerarbeitung
- article-analysis.tsx (6, ⚠2): SessionDetails
- database-admin.tsx (34, ⚠3): DatabaseAdmin

### components/ratsmonitor/
- App.tsx (75, ⚠2): MonitorApp

### components/ratsmonitor/components/
- AccountMenu.tsx (90, ⚠4): AccountMenu
- ActiveFilters.tsx (117, ⚠1): ActiveFilters
- AreaBar.tsx (101, ⚠1): AreaBar
- ArtIcon.tsx (71, ⚠1): ArtIcon
- BandDots.tsx (50): BandDots
- BottomNav.tsx (55, ⚠1): BottomNav
- Brand.tsx (275): AnalyticsX, AnalyticsLogo, Brand
- CalendarFeed.tsx (106): CalendarFeed
- ChipRail.tsx (35, ⚠1): RailItem, ChipRail, kurz
- ConfirmDialog.tsx (76): confirmDialog, ConfirmDialog
- ContextMenu.tsx (35): MenuItem, ContextMenu
- CountDots.tsx (9): CountDots
- DateBadge.tsx (14): DateBadge
- DateRangeFilter.tsx (98): DateRangeSelect, DateRangeFields, DateRangeFilter
- DevBrandSwitcher.tsx (30): DevBrandSwitcher
- DevTierSwitcher.tsx (25): DevTierSwitcher
- DotField.tsx (86): DotField
- Dropdown.tsx (66): DropItem, Dropdown, AktiveFilter
- FilterPanel.tsx (124, ⚠2): FilterPanel
- FilterSelect.tsx (122): FilterSelect
- FollowButton.tsx (28): NOTIFY_LATER, FollowButton
- Footer.tsx (65): Footer
- GateDialog.tsx (148): GateFeature, openGate, openLimitGate, GateDialog
- Header.tsx (128, ⚠2): Header
- ImportDialog.tsx (151): ImportDialog
- PlanCards.tsx (154, ⚠1): PlanCards, PlanSummary
- PullToRefresh.tsx (27): PullToRefresh
- SaveArticleButton.tsx (29): SaveArticleButton
- SaveSearchDialog.tsx (25, ⚠1): SaveSearchDialog
- SearchBox.tsx (381, ⚠1): isSearchInput, focusSearch, SearchBox
- SearchFilterPanel.tsx (68): SearchFilterPanel
- SearchOverlay.tsx (87): SearchOverlay
- Segmented.tsx (66): Segmented
- ShareButton.tsx (49): shareLink, ShareButton
- SubtopicIcon.tsx (81, ⚠1): SubtopicIcon
- TierNotice.tsx (67): AccountLoading, LoginRequired, UsagePill
- TopicSeed.tsx (11): TopicSeed
- WheelList.tsx (42): WHEEL_ROW, WheelList
- icons.tsx (193): IconSearch, IconPin, IconX, IconChevronDown, IconViewFull, IconViewCompact, IconCalendar, IconChevronRight, IconChevronLeft, IconCheck, IconPlus, IconMinus, IconCenter, IconReset, IconArrowUp, IconUser, IconBookmark, IconEmptySearch, IconDoc, IconRules, IconBell, IconFilter, IconStar, IconHeart, IconDownload, IconCalendarSync, ThemeIcon

### components/ratsmonitor/components/map/
- MapPanel.tsx (345, ⚠2): MapPanel

### components/ratsmonitor/components/results/
- ArticleCard.tsx (174, ⚠2): Highlight, ArticleCard, StepTimeline
- ResultsPanel.tsx (223): ResultsPanel

### components/ratsmonitor/components/
- suggestRows.ts (214): Row, notePick, takePickedText, RowContext, buildRows

### components/ratsmonitor/info/
- AccountPages.tsx (640): LoginPage, ConfirmLoginPage, RegisterPage, KontaktPage
- AgbPage.tsx (182, ⚠15): AgbPage
- AnwenderLive.tsx (173, ⚠2): AnwenderLivePage
- BenachrichtigungenPage.tsx (95): BenachrichtigungenPage
- BranchenLive.tsx (244): LiveThumb
- BranchenPages.tsx (121): BranchePage
- FaqPage.tsx (45, ⚠1): FaqPage
- InfoPages.tsx (46): InfoPages
- LegalText.tsx (20): H2, P, Ul
- NotFoundPage.tsx (30): NotFoundPage
- PreisePage.tsx (86): PreisePage
- QuellenPage.tsx (174, ⚠3): QuellenPage
- StartseitePage.tsx (508, ⚠1): StartseitePage
- TodoControls.tsx (139, ⚠12): TodoChoice, TodoPerson, TodoOwner, TodoPriorityChoice, TodoStatusChoice, TodoOrder, TodoEditor
- TodoPage.tsx (267, ⚠24): TodoPage
- VideosPage.tsx (172): VideosPage
- WiderrufPage.tsx (79): WiderrufPage
- XAuszug.tsx (220, ⚠2): XAuszug
- anwender-beispiele.ts (37, ⚠21): BEISPIELE
- blocks.tsx (266, ⚠1): useOpenSearch, Rich, PageHead, SearchTermButton, PlacePill, HitPreview, DarkCta, QaItem, Ladefehler, InfoHints
- branchen-enterprise.ts (115, ⚠1): AnalyseId, AnalyseGruppe, GRUPPEN, ANALYSEN, NEU_HREF, NEU_NAME, EINBLICKE, HINTERGRUENDE, PLENARAX_VORTEILE, EnterpriseBlock, ENTERPRISE
- content.ts (281, ⚠27): Status, Example, Branche, Qa, FAQ, PRICE_FAQ, PlanId, Rich, Plan, PLANS, BRANCHEN, brancheBySlug
- icons.tsx (128): IconName, Icon
- useTodoBoard.ts (208, ⚠2): TodoPatch, TodoCreate, useTodoBoard

### components/ratsmonitor/lib/
- account.ts (283): Me, ACCOUNT_REV, getMe, AccountApiError, api, touchAccount, loadMe, accountChanged, logout, setViewTier, devLogin, useMe, onMe, shortDate
- bandFigure.ts (32): publishBandFigure, useBandFigure, useCountUp
- betreiber.ts (20): BETREIBER, betreiberAdresse
- brand.ts (52): setLogo, useBrand, useBrandText
- brands.ts (45): BrandId, BRAND_NAME, LogoId, LOGOS, LOGO_IDS, DEFAULT_LOGO, DEFAULT_BRAND, pageTitle
- browserData.ts (283): IMPORTED_KEY, WEEK_DAYS, LocalArticle, LocalData, ImportPayload, ImportResult, useLocalData, hasLocal, shouldAsk, postponeImport, localSummary, buildPayload, downloadFile, saveLocalFile, importLocal, discardLocal, importFile, resultText
- calendarAreas.ts (35): CalArea, areaOwners, calendarAgs, cleanAreas
- catalog.ts (22): loadCatalog, useCatalog
- clipboard.ts (26): copyText
- constants.ts (63, ⚠1): THEMEN, shownThema, StatusInfo, STATUS, STATUS_BY_ID, MAP_COLORS, MAP_COLORS_DARK, colorForCoverageDark, colorForCoverage, STATUS_COLOR
- entitlements.ts (50): useEntitlements
- favicon.ts (39, ⚠1): faviconHref, setFavicon
- fetchJson.ts (44): ApiError, fetchJson, readJson, fetchOrFail, errorText
- filter.ts (25): FilterSpec, FilterKey, matches
- filtersOpen.ts (19): setFiltersOpen, useFiltersOpen
- format.ts (7): nf, num, pctText

### components/ratsmonitor/lib/geo/
- geoModel.ts (360): BBox, Layer, HierEntry, AreaInfo, decodeArc, GeoModel
- mapEngine.ts (1118): MapEngineCallbacks, MapStyle, MapEngine

### components/ratsmonitor/lib/
- haptic.ts (5): tick
- homePlace.ts (39): HomePlace, useHomePlace
- iconStroke.ts (3): iconStroke
- listView.ts (47): ListView, setListView, useListView
- mapSlot.ts (18): setMapSlot, clearMapSlot, useMapSlot
- otherTab.ts (11): onOtherTab
- pageTitle.ts (41): pageName, tabTitle
- place.ts (287, ⚠1): PlaceEntry, PlaceHit, ParseResult, SuggestResult, regionSuggest, regionsIn, PlaceIndex, removePhrase
- queue.ts (29): queue
- radioKeys.ts (18): radioKeys, radioTab
- recentSearches.ts (32): readRecent, addRecent, clearRecent
- routes.ts (10): INFO_PATHS, ANALYTICS_PATHS, brancheOf, isInfoPath, isAnalyticsPath
- savedArticles.ts (151): SavedArticle, toggleSavedArticle, removeSavedArticle, restoreSavedArticle, useSavedArticles, useSavedArticlesReady
- savedSearch.ts (155, ⚠1): SearchSnapshot, snapshotOf, signature, queryText, canonicalQuery, hasFilters, FilterChip, placeLabel, filterChips, RangePreset, RANGE_PRESETS, presetOf, resolveRange, rangeLabel, hasScope, splitTerms, suggestName
- searchLogic.ts (104): Parse, isCommitted, applySearchState, commitPlacesState, isReplacement, clearAreaState, deriveFilters
- searchUrl.ts (106): readableQuery, SEARCH_URL_KEYS, searchToUrl, onlyText, searchFromUrl
- sheetStage.ts (26): SheetStage, setSheetStage, toggleSheetStage, useSheetStage, setPeekHidden, usePeekHidden
- terms.ts (24, ⚠2): isFiller, prettyTerm, termStem
- text.ts (96): normChar, norm, FILLER, terms, Segment, highlightSegments, plural, parseDate, fmtDate, isoDay, todayLocal, MONTH_FMT, MONTH_SHORT, monthLabel
- tier.ts (68): Tier, TierLimits, PLAN_MAX, LIMITS, TIER_LABEL, priceLabel, UPGRADE_TEXT, IS_DEV, getTier, setTier, useTier, usage
- todos.ts (118): TodoStatus, TodoPersonId, TodoResolution, TodoPriority, TodoSubtask, TODO_STATUSES, TODO_PRIORITIES, TODO_RESOLUTIONS, TODO_PEOPLE, TodoItem, TodoCategory, TodoData, taskStatus, todoPriority, taskResolution, normalizeTodoItem, TodoKind, TodoState, localToday, fmtShort, todoState
- topicCache.ts (43): TopicError, seedTopic, peekTopic, loadTopic, prefetchDetail
- useClient.ts (12): useClient, useHydrated
- useDarkMode.ts (40): useDarkMode
- useInstall.ts (27): isStandalone, useInstall
- useLongPress.ts (32): useLongPress
- usePhone.ts (30): PHONE_QUERY, isPhone, usePhone, useTinyPhone
- useScrollMemory.ts (49): useScrollMemory
- useSwipe.ts (30): useSwipe
- uuid.ts (12): newId
- viewClamp.ts (18): NetViewState, NetBox, clampView

### components/ratsmonitor/menu/
- MainMenu.tsx (295, ⚠1): ANWENDER, XEintrag, ANALYSE, EINBLICKE, HINTERGRUENDE, INFO, MainMenu, XGruppe
- MeinSheet.tsx (29): MeinSheet
- MoreSheet.tsx (33, ⚠1): MoreSheet
- SegTiles.tsx (25): Segmented, Tile
- Sheet.tsx (97, ⚠1): Sheet
- XSwitcher.tsx (34): XSheet

### components/ratsmonitor/pages/
- DetailPage.tsx (144, ⚠7): DetailPage
- KalenderPage.tsx (401, ⚠2): KalenderPage
- LegalPage.tsx (281): useInhalt, LegalPage
- NotificationsPage.tsx (92): NotificationsPage
- OverviewPage.tsx (172): OverviewPage
- PersonalPage.tsx (28): PersonalPage
- PostfachPage.tsx (64): PostfachPage
- ProfilePage.tsx (454): ProfilePage
- SavedArticlesPage.tsx (156, ⚠3): SavedArticlesPage
- SavedSearchesPage.tsx (255, ⚠1): SavedSearchesPage, WeeklyReport
- WillkommenPage.tsx (60): WillkommenPage

### components/ratsmonitor/pages/analytics/
- AnalyticsAbout.tsx (232, ⚠18): ANALYSE_THUMBS, MethodikText
- AnalyticsLocked.tsx (54): AnalyticsLocked
- AnalyticsPages.tsx (64): AnalyticsPages
- AtlasMap.tsx (107, ⚠2): AtlasMap
- AtlasPage.tsx (76): ATLAS_THEMEN, atlasHref, AtlasPage
- AtlasParts.tsx (186, ⚠1): Row, Result, Fact, n, MIN_BASE, isRest, restLast, Bars, Hint, OrtImVergleich, Level, AtlasExtra, PartList, PlaceChip
- Befund.tsx (70): Befund, zuThema, Leer, Fehler
- BeschluessePage.tsx (239, ⚠13): BeschluessePage
- CompareCharts.tsx (69, ⚠2): PLACE_COLORS, CompareLines, TopicPair
- CompareFields.tsx (71): FIELD, PlaceField
- ComparePage.tsx (369, ⚠10): ComparePage
- CompareParts.tsx (74, ⚠3): Share, Place, Result, ORT, asPlace, n, inhaltlich, datenlage, Hinweis, Duell
- DecisionCharts.tsx (66, ⚠2): DEC_COLORS, Cut, Month, MonthColumns, DecisionRow
- DiffusionSearch.tsx (94, ⚠4): PlayState, DiffusionSearch
- FaktenPage.tsx (381, ⚠6): FaktenPage
- FraktionenPage.tsx (200, ⚠7): FraktionenPage
- GraphView.tsx (388, ⚠2): GNode, GEdge, KIND, seeded, GraphView
- GremiennetzPage.tsx (220, ⚠4): GremiennetzPage
- Kennzahlen.tsx (132, ⚠1): weekAgo, Kennzahlen, countScale, zeitText, ZeitExtra, ZeitPills, useOrtInAdresse, MeinOrt, Folgen
- KnowledgeGraphPage.tsx (304, ⚠9): KnowledgeGraphPage
- Laden.tsx (32): Laden
- ListRow.tsx (34, ⚠1): ListRow
- ListSkeleton.tsx (13): ListSkeleton
- MapHint.tsx (23): MapHint
- MapWheels.tsx (122, ⚠3): MapWheels, MapPill
- MeinOrtNeu.tsx (41): MeinOrtNeu
- Methodik.tsx (43): METHODIK_VON, MethodikUnten, MethodikNote
- NetControls.tsx (50): Level, netLevel, LevelSegmented, LevelPill, NetLegend, NetZoom
- NetView.tsx (320): NNode, NEdge, ROLE, NetKind, NET_KIND, netKind, NetView
- NewsradarPage.tsx (138, ⚠1): NewsradarPage
- PageBand.tsx (23): PageBand
- RadarDrill.tsx (130, ⚠3): DrillItem, StatusDot, RadarDrill
- RadarThumbs.tsx (123): RADAR_THUMBS
- RegionMap.tsx (178, ⚠5): RegionMap
- Reveal.tsx (16): Reveal
- SignalePage.tsx (377, ⚠12): signaleHref, SignalePage
- SplitHandle.tsx (53): SplitHandle
- Tabs.tsx (7): TabPane
- TrendViews.tsx (72, ⚠1): Trend, TrendKind, Spark, TrendMap
- XAtlasView.tsx (331, ⚠10): XAtlasView
- XBusy.tsx (14): busyProps, PendingVeil, HERO_MAIN, HERO_PANEL
- XKopf.tsx (218, ⚠1): XKopf, XWeiter, ThemenLeiste
- XTrendsPage.tsx (369, ⚠4): XTrendsPage
- XTrendsParts.tsx (153, ⚠1): DAY, toDay, toIso, fmt, AGE_LEGEND, SpreadRegion, keysOf, SpreadMap, PlayButton, SpreadChart, MiniCurve
- useAnalysisRun.ts (70): useAnalysisRun
- useAnalyticsQuery.ts (81): useAnalyticsQuery

### components/ratsmonitor/services/
- api.ts (7, ⚠1): SAVED_SEARCHES_KEY, readSavedSearches

### components/ratsmonitor/state/
- account.tsx (108): AccountProvider, useAccount, useSavedStats
- data.tsx (36, ⚠1): DataProvider, useData
- nav.ts (17, ⚠1): View, viewOf, noteRoute, cameFromApp, overviewScroll, useAppNav
- search.tsx (665, ⚠4): INITIAL_SEARCH, SearchProvider, useSearch, CoverageEntry, SearchResults, savedSearchState, savedSearchQuery, useSearchResults
- toast.tsx (66): ToastProvider, useToast
- ui.tsx (29): UiProvider, useUi

### components/ratsmonitor/
- types.ts (130): StatusId, ArticleData, Article, MapLayerData, MapData, AreaSource, Radius, SearchState, NotifyFreq, SavedSearch

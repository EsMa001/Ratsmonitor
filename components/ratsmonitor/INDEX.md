# Frontend-Index (erzeugt, nicht von Hand ändern)

Neu erzeugen: `node scripts/frontend-index.mjs`. Ergänzt `FRONTEND.md` (Wo ist was?) um Dateien, Exporte und CSS-Klassen mit Zeilennummer.
`⚠N` = N Zeilen über 300 Zeichen: dort nicht ganze Zeilen lesen, sondern mit `grep -o` oder `grep -n` gezielt suchen.

## CSS-Klassen (Klasse Datei:Zeile)

- app/admin.css (497 Zeilen, ⚠11)
- app/analyse-admin.css (59 Zeilen, ⚠6)
- app/design-styles.css (254 Zeilen)
- app/design-tokens.css (75 Zeilen)
- app/globals.css (24 Zeilen, ⚠2)
- app/styles/analytics.css (1585 Zeilen, ⚠2)
- app/styles/base-layer.css (95 Zeilen, ⚠1)
- app/styles/base.css (622 Zeilen)
- app/styles/dark.css (436 Zeilen, ⚠3)
- app/styles/glass.css (180 Zeilen)
- app/styles/header.css (411 Zeilen)
- app/styles/info.css (1266 Zeilen)
- app/styles/print.css (61 Zeilen)
- app/styles/search.css (317 Zeilen)
- app/styles/tokens.css (311 Zeilen, ⚠1)

absolute base.css:370
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
admin-app dark.css:297
admin-app tokens.css:305
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
admin-notice dark.css:297
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
animate-pulse search.css:313
animate-spin search.css:313
back-btn analytics.css:285
back-btn base-layer.css:53
back-btn print.css:20
bg-slate-900 dark.css:188
bg-teal-50 dark.css:249
bg-teal-50 glass.css:68
bg-teal-600 dark.css:301
bg-teal-700 dark.css:180
bg-white dark.css:257
border-slate-100 dark.css:116
bottom-3 analytics.css:692
btn-danger base-layer.css:47
btn-primary admin.css:161
btn-primary base-layer.css:38
btn-primary base.css:28
btn-primary dark.css:77
btn-secondary admin.css:161
btn-secondary base-layer.css:41
btn-sm admin.css:215
btn-sm base-layer.css:44
button design-styles.css:58
button--primary design-styles.css:69
card-shell base-layer.css:73
card-shell search.css:11
docs design-styles.css:207
eyebrow admin.css:6
eyebrow analyse-admin.css:14
facts design-styles.css:192
facts__row design-styles.css:193
field-help base-layer.css:63
field-input base-layer.css:57
field-label base-layer.css:60
figure design-styles.css:197
fixed base.css:374
flex-col analytics.css:1424
font-bold base.css:11
font-medium base.css:19
font-semibold base.css:15
gap-10 analytics.css:1084
gap-10 info.css:899
gap-6 analytics.css:1090
gap-8 analytics.css:1087
gap-y-12 analytics.css:1075
gap-y-12 info.css:879
gap-y-6 analytics.css:1081
gap-y-8 analytics.css:1078
gap-y-8 info.css:882
grid analytics.css:506
group dark.css:149
h-16 info.css:932
heading-m design-styles.css:44
hidden analytics.css:282
icon design-styles.css:22
inset-x-16 analytics.css:180
inset-x-16 dark.css:353
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
left-3 analytics.css:516
legend design-styles.css:251
link-btn base-layer.css:50
map-canvas analyse-admin.css:33
mb-6 info.css:905
mb-8 analytics.css:1051
min-w-0 analytics.css:157
min-w-0 dark.css:341
monthly-mix analyse-admin.css:23
mt-10 analytics.css:1060
mt-12 analytics.css:1057
mt-16 analytics.css:1054
mt-3 info.css:917
mt-4 analytics.css:1072
mt-4 info.css:914
mt-5 analytics.css:1069
mt-5 info.css:888
mt-6 analytics.css:1066
mt-6 info.css:908
mt-8 analytics.css:1063
needs-attention admin.css:6
notice design-styles.css:245
page design-styles.css:34
page-error-action analyse-admin.css:55
page-note design-styles.css:36
page-note base-layer.css:89
page-note dark.css:201
pb-10 analytics.css:1048
pl-band analytics.css:267
pl-cta info.css:849
pl-ctawrap info.css:1118
pl-cut3 info.css:1165
pl-footer-accent dark.css:111
pl-footer-accent info.css:826
pl-grid info.css:1023
pl-h1 info.css:1032
pl-h2 info.css:999
pl-hero info.css:987
pl-left info.css:1029
pl-mapcol info.css:1077
pl-mapwrap info.css:1080
pl-num info.css:995
pl-opt info.css:1151
pl-ort info.css:1110
pl-ort search.css:302
pl-ping info.css:974
pl-plus--inline info.css:1014
pl-plus--map info.css:1135
pl-pop info.css:970
pl-pulse info.css:1141
pl-search search.css:297
pl-slogan info.css:991
pl-source info.css:1054
pl-stand info.css:1054
pl-still info.css:1098
pl-top analytics.css:1162
pl-tp info.css:960
pl-trends info.css:1061
popover base-layer.css:76
process design-styles.css:119
process__bar design-styles.css:121
process__label design-styles.css:123
process__step design-styles.css:120
process__step--open design-styles.css:122
prose analyse-admin.css:8
prose design-styles.css:201
prose base-layer.css:86
py-10 analytics.css:1099
py-2 info.css:924
py-3 info.css:920
py-6 info.css:928
ratsmonitor base-layer.css:3
ratsmonitor base.css:3
ratsmonitor dark.css:63
ratsmonitor header.css:21
ratsmonitor info.css:658
ratsmonitor print.css:48
ratsmonitor search.css:288
ratsmonitor tokens.css:154
relative analytics.css:157
relative dark.css:341
ri dark.css:82
ri header.css:40
ri info.css:2
ri search.css:292
ri-actions analytics.css:1205
ri-actions info.css:76
ri-actions--far info.css:83
ri-anw analytics.css:1149
ri-anw info.css:859
ri-below info.css:1168
ri-below__h info.css:1171
ri-below__lead info.css:1179
ri-bid analytics.css:1196
ri-bid info.css:87
ri-bid__icon analytics.css:1196
ri-bid__icon info.css:93
ri-bid__label analytics.css:1312
ri-bid__label info.css:99
ri-bid__name analytics.css:1289
ri-bid__name dark.css:73
ri-bid__name info.css:109
ri-btn info.css:20
ri-btn--bare info.css:772
ri-btn--block info.css:71
ri-btn--dark dark.css:161
ri-btn--dark info.css:39
ri-btn--inv dark.css:105
ri-btn--inv info.css:62
ri-btn--light info.css:51
ri-burger info.css:619
ri-burger--no-phone info.css:653
ri-check info.css:577
ri-dark dark.css:87
ri-dark info.css:248
ri-dark__row info.css:258
ri-dark__sub dark.css:101
ri-dark__sub info.css:275
ri-err info.css:570
ri-faq-group info.css:367
ri-faq-group__label info.css:371
ri-faq-list info.css:379
ri-faq-list--top info.css:386
ri-field info.css:513
ri-form info.css:501
ri-form--center info.css:509
ri-form__foot info.css:611
ri-h1 analytics.css:1168
ri-h1 dark.css:73
ri-h1 info.css:117
ri-h1--sm info.css:126
ri-h2 dark.css:73
ri-h2 info.css:155
ri-h2--gap info.css:453
ri-h2--live info.css:1231
ri-h2--md info.css:164
ri-head analytics.css:1014
ri-head dark.css:197
ri-head--compact analytics.css:1041
ri-head__grid analytics.css:1019
ri-head__grid--top analytics.css:1026
ri-help info.css:564
ri-input info.css:525
ri-konto analytics.css:1152
ri-konto info.css:895
ri-lead analytics.css:1190
ri-lead info.css:131
ri-link info.css:595
ri-menu header.css:40
ri-menu print.css:16
ri-menu__bg header.css:108
ri-menu__chev header.css:234
ri-menu__group header.css:215
ri-menu__main header.css:132
ri-menu__nav header.css:128
ri-menu__panel header.css:50
ri-menu__panel--flyout header.css:282
ri-menu__start header.css:200
ri-menu__sub header.css:159
ri-menu__subs header.css:153
ri-pills info.css:283
ri-place info.css:316
ri-point info.css:339
ri-point__num info.css:344
ri-points info.css:332
ri-points--2 info.css:739
ri-pv info.css:291
ri-pv__card analytics.css:1112
ri-pv__card info.css:298
ri-pv__topics-label info.css:307
ri-qa info.css:390
ri-qa__a info.css:432
ri-qa__a--todo info.css:440
ri-qa__sign info.css:420
ri-qa__sign--minus info.css:424
ri-qa__sign--plus info.css:424
ri-sec info.css:140
ri-sec--faq info.css:150
ri-sec--prices info.css:448
ri-sec--snug info.css:1224
ri-sec--tight info.css:145
ri-sub info.css:168
ri-submit info.css:605
ri-table info.css:457
ri-table__first info.css:496
ri-tl info.css:177
ri-tl__icon info.css:200
ri-tl__label info.css:215
ri-tl__step info.css:196
ri-tl__step--out info.css:210
ri-tl__title dark.css:73
ri-tl__title info.css:229
ri-toc info.css:1188
ri-toc print.css:57
ri-topnav header.css:248
right-3 analytics.css:185
right-3 dark.css:353
rm-analytics analytics.css:832
rm-analytics dark.css:390
rm-art-std analytics.css:70
rm-attr search.css:166
rm-band-mid analytics.css:294
rm-banddots analytics.css:1255
rm-bar base.css:226
rm-brandtag analytics.css:1230
rm-chip analytics.css:381
rm-chip dark.css:68
rm-chip glass.css:73
rm-dark admin.css:461
rm-dark analytics.css:1106
rm-dark dark.css:2
rm-dark glass.css:144
rm-dark header.css:316
rm-dark info.css:839
rm-dark tokens.css:170
rm-deskbar analytics.css:373
rm-dialog base.css:305
rm-dialog dark.css:424
rm-dotfield analytics.css:1372
rm-dotfield base.css:528
rm-dotfield search.css:308
rm-dotfield-on base.css:542
rm-dots search.css:55
rm-draw base.css:204
rm-flat analytics.css:1408
rm-flat dark.css:197
rm-flat search.css:11
rm-focusrows base.css:230
rm-footcta search.css:194
rm-fpop analytics.css:821
rm-fpop dark.css:324
rm-fpop glass.css:108
rm-gflow base.css:184
rm-gin base.css:168
rm-glass analytics.css:696
rm-glass dark.css:14
rm-glass glass.css:4
rm-glass print.css:16
rm-glass-pop dark.css:243
rm-glass-pop glass.css:61
rm-gpulse base.css:174
rm-gpulse2 base.css:180
rm-gtext analytics.css:981
rm-gtext dark.css:215
rm-headtitle header.css:362
rm-karte-toggle analytics.css:70
rm-legalbar search.css:185
rm-legend analytics.css:218
rm-legend dark.css:2
rm-legend glass.css:19
rm-legend print.css:16
rm-liquid analytics.css:696
rm-liquid dark.css:418
rm-logo analytics.css:1319
rm-logo dark.css:59
rm-logo header.css:63
rm-logo--big header.css:305
rm-logo__mark header.css:4
rm-logo__mark--p header.css:11
rm-logo__text header.css:77
rm-mapbox analytics.css:34
rm-mapbox dark.css:353
rm-mapbox search.css:262
rm-mapctl search.css:166
rm-mapwrap analytics.css:22
rm-mapwrap glass.css:130
rm-netstage analytics.css:625
rm-netzoom analytics.css:684
rm-noplay analytics.css:60
rm-pagein base.css:294
rm-pmark base.css:568
rm-pmark header.css:366
rm-rail-folded analytics.css:549
rm-rail-mini analytics.css:1519
rm-rail-open analytics.css:545
rm-rail-peek analytics.css:545
rm-rail-sub analytics.css:76
rm-rail-sub dark.css:366
rm-rail-toggle analytics.css:1558
rm-sbar search.css:148
rm-schritt-std analytics.css:107
rm-search analytics.css:1488
rm-search search.css:89
rm-searchsplit analytics.css:1488
rm-searchsplit search.css:198
rm-sec base.css:351
rm-sec-m base.css:355
rm-sec-s base.css:359
rm-solid analytics.css:60
rm-solid dark.css:324
rm-solid glass.css:108
rm-spinner search.css:44
rm-stage analytics.css:1325
rm-stage-chip analytics.css:629
rm-stage-chip dark.css:418
rm-statusstrip dark.css:413
rm-statusstrip header.css:28
rm-step base.css:263
rm-sub-std analytics.css:525
rm-sub-wide analytics.css:525
rm-tabbar header.css:24
rm-topline dark.css:197
rm-wheel-list analytics.css:846
rm-wheel-list dark.css:406
rm-wheel-list glass.css:144
rm-wheels-lower analytics.css:1329
rm-xbtn analytics.css:935
rm-xcta info.css:1245
rm-xebene analytics.css:92
rm-xebene dark.css:337
rm-xfield analytics.css:935
rm-xfilter analytics.css:63
rm-xfilter print.css:54
rm-xfilter-chips analytics.css:70
rm-xhandle analytics.css:888
rm-xhero analytics.css:462
rm-xhero-panel analytics.css:462
rm-xlegend analytics.css:783
rm-xnet analytics.css:60
rm-xnet dark.css:330
rm-xrail analytics.css:73
rm-xrail dark.css:346
rm-xschritt analytics.css:417
rm-xschritt dark.css:358
rm-xsearch analytics.css:60
rm-xsearch dark.css:341
rm-xsearch print.css:51
rm-xseg analytics.css:607
rm-xseg dark.css:369
rm-xsplit analytics.css:5
rm-xsplit--solo analytics.css:8
rm-xsplit-map analytics.css:14
rm-xstage analytics.css:607
rm-xtop analytics.css:192
rm-xwide analytics.css:42
rm-xwide dark.css:330
rm-xzeit analytics.css:110
rm-xzeit dark.css:330
rm-zeit-std analytics.css:107
scroll-thin base-layer.css:79
section design-styles.css:249
section-title design-styles.css:39
select-active analytics.css:838
select-active base-layer.css:69
select-active glass.css:55
select-base admin.css:460
select-base analytics.css:832
select-base base-layer.css:66
select-base dark.css:272
select-base glass.css:28
session design-styles.css:159
session-details analyse-admin.css:37
sessions design-styles.css:158
setting design-styles.css:211
setting__hint design-styles.css:214
setting__label design-styles.css:212
setting__name design-styles.css:213
share-button design-styles.css:82
skip-link analyse-admin.css:6
skip-link print.css:16
space-y-6 analytics.css:1096
space-y-6 info.css:885
space-y-8 analytics.css:1093
steps design-styles.css:114
steps__bar design-styles.css:115
steps__bar--done design-styles.css:116
sticky analytics.css:1358
sticky dark.css:51
sticky header.css:316
switch design-styles.css:217
tabs analyse-admin.css:7
tabs design-styles.css:135
tag analyse-admin.css:7
tag design-styles.css:99
text-link admin.css:6
text-link analyse-admin.css:58
text-link design-styles.css:72
text-link base.css:38
text-slate-900 dark.css:129
text-teal-700 base.css:370
text-white dark.css:184
timeline design-styles.css:204
top-3 analytics.css:632
topic design-styles.css:140
touch-none analytics.css:1333
touch-pan-y analytics.css:113
touch-pan-y dark.css:330
truncate base.css:559
z- analytics.css:632

## Dateien (Zeilen, Exporte)


### app/(monitor)/abbestellen/
- page.tsx (4): metadata, Page

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

### app/(monitor)/kuendigen/
- page.tsx (4): metadata, Page

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

### app/(monitor)/verbinden/
- page.tsx (4): metadata, Page

### app/(monitor)/videos/
- page.tsx (4): metadata, Page

### app/(monitor)/widerruf/
- page.tsx (4): metadata, Page

### app/admin/
- page.tsx (93, ⚠7): dynamic, metadata, AdminPage

### app/
- chatgpt-auth.ts (92): ChatGPTUser, getChatGPTUser, chatGPTSignInAvailable, chatGPTSignInPath, chatGPTSignOutPath
- error.tsx (13, ⚠1): PageError
- global-error.tsx (14, ⚠1): GlobalError
- layout.tsx (12, ⚠2): metadata, viewport, RootLayout
- not-found.tsx (4): metadata, NotFound

### app/oauth/authorize/
- route.ts (6): dynamic, GET

### app/oauth/register/
- route.ts (7): dynamic, POST, OPTIONS

### app/oauth/revoke/
- route.ts (7): dynamic, POST, OPTIONS

### app/oauth/token/
- route.ts (7): dynamic, POST, OPTIONS

### app/
- robots.ts (12): robots
- site-url.ts (3): SITE_URL
- sitemap.ts (12): sitemap

### components/
- admin-accounts.tsx (153): AdminAccounts
- admin-activation.tsx (7, ⚠1): AdminActivation
- admin-ai-local.tsx (117, ⚠8): AdminAiLocal
- admin-altbestand.tsx (149, ⚠7): AdminAltbestand, AltbestandSteuern
- admin-atlas.tsx (204, ⚠29): AdminAtlas
- admin-catch-up.tsx (10): RegionCatchUp
- admin-chrome.tsx (146, ⚠1): AdminPage, AdminEntry, ADMIN_GROUPS, START_PAGE, ADMIN_PAGES, VISIBLE_PAGES, groupOf, adminHref, AdminBar, AdminFrame
- admin-cockpit.tsx (104): AdminCockpit
- admin-colors.ts (26): AC, HATCH_CSS, COVERAGE, shareColor, bucketColor, ACCESS_COLOR, CATEGORY_COLOR
- admin-dashboard.tsx (111, ⚠7): AdminRuns, AdminReview, AdminStock
- admin-debug.tsx (144, ⚠9): AdminDebug
- admin-estimate.tsx (350, ⚠57): AdminEstimate
- admin-fehler.tsx (100, ⚠4): AdminFehler, FehlerSteuern
- admin-format.ts (25): n, nOr, pct, mio, gb, size, day, mm, when, clock, dur
- admin-icons.tsx (42): IconName, Icon
- admin-loader.tsx (39): DashboardPage, AdminLoader
- admin-mobile.tsx (45, ⚠2): AdminMobile
- admin-overview.tsx (174, ⚠14): AdminOverview
- admin-pdf-parts.tsx (161, ⚠10): month, KIND, MonthRow, MonthBars, SpaceBar, ProcessFlow, Host, HostList, RunStep, Run, RunList, Quality, scorePct, QualityTable
- admin-pdf.tsx (280, ⚠17): AdminPdf, PdfSteuern
- admin-pipeline-parts.tsx (109, ⚠3): Step, FailRow, Glossary, StepList, result, Timeline, FailureTable, HostTable, ProviderTable
- admin-processing-map.tsx (50, ⚠3): AdminProcessingMap
- admin-processing.tsx (191, ⚠21): AdminProcessing
- admin-quality-check.tsx (73, ⚠4): AdminQualityCheck
- admin-rule-texts.tsx (258, ⚠14): AdminRuleTexts
- admin-run-debug.tsx (70, ⚠2): AdminRunDebug
- admin-schedules.tsx (170, ⚠4): AdminSchedules
- admin-signout.tsx (13): AdminSignOut
- admin-social.tsx (131, ⚠2): AdminSocial
- admin-source-notes.tsx (21, ⚠1): SourceNotes
- admin-stand.tsx (28): standText, StandLine
- admin-storage.tsx (143, ⚠9): AdminStorage, SpeicherSteuern
- admin-store.ts (98): ADMIN_REGIONS_DONE, CatchUp, useRegionCatchUp, setAdminStaticVersion, fetchDashboard
- admin-texts.ts (387, ⚠7): href, Todo, Help, PAGE_HEAD, FOOT, ZUSTAND, JOB_STATE_HELP, HELP, TERMS, FILTER_HELP, MAP_HELP, STATE_HELP, ATLAS_TODO, REVIEW_HELP, FIELD_HELP, FIELD_FOOT, QUALITY_EXPLAIN, QUALITY_FIGURE_HELP, QUALITY_TEXT, COL_HELP, PROTOKOLL, TITLES, HOCHRECHNUNG
- admin-timeline.tsx (87, ⚠4): AdminTimeline
- admin-todo.tsx (11): AdminTodo
- admin-totp.tsx (62): AdminTotp, AdminTotpSetup
- admin-ui.tsx (166): short, AdminPageHead, Befund, Zahlen, Abschnitt, Aufklapp, Hinweis, Fehler, Leer, Laden, SteuernLink, Kpi, Kpis, How, SectionHelp, SectionTodo, Skeleton, PageSkeleton, Legend, Alert, AdminChoice, AdminAreaPick
- admin-verarbeitung.tsx (37, ⚠1): AdminVerarbeitung
- database-admin.tsx (34, ⚠3): DatabaseAdmin

### components/ratsmonitor/
- App.tsx (76, ⚠2): MonitorApp

### components/ratsmonitor/components/
- AboModels.tsx (49): AboModels
- AccountMenu.tsx (90, ⚠4): AccountMenu
- ActiveFilters.tsx (125): ActiveFilters
- AreaBar.tsx (101, ⚠1): AreaBar
- ArtIcon.tsx (156, ⚠1): artIconOf, ArtIcon
- BandDots.tsx (50): BandDots
- BottomNav.tsx (55, ⚠1): BottomNav
- Brand.tsx (275): AnalyticsX, AnalyticsLogo, Brand
- CalendarFeed.tsx (106): CalendarFeed
- ChipRail.tsx (8): RailItem, kurz
- ConfirmDialog.tsx (76): confirmDialog, ConfirmDialog
- ContextMenu.tsx (35): MenuItem, ContextMenu
- CountDots.tsx (9): CountDots
- DateBadge.tsx (14): DateBadge
- DateRangeFilter.tsx (98): DateRangeSelect, DateRangeFields, DateRangeFilter
- DevBrandSwitcher.tsx (30): DevBrandSwitcher
- DevTierSwitcher.tsx (25): DevTierSwitcher
- DotField.tsx (86): DotField
- Dropdown.tsx (66): DropItem, Dropdown, AktiveFilter
- FilterPanel.tsx (137, ⚠2): FilterPanel
- FilterSelect.tsx (124, ⚠1): FilterSelect
- FollowButton.tsx (36): FollowButton
- Footer.tsx (79): LEGAL, Footer
- GateDialog.tsx (189): GateFeature, needsFor, openGate, openLimitGate, GateDialog
- Header.tsx (144, ⚠2): Header
- ImportDialog.tsx (151): ImportDialog
- PlanCards.tsx (288, ⚠1): planFeatures, PlanCards, PlanSummary
- PlusHint.tsx (40, ⚠1): PlusHint
- PullToRefresh.tsx (27): PullToRefresh
- SaveArticleButton.tsx (29): SaveArticleButton
- SaveSearchDialog.tsx (25, ⚠1): SaveSearchDialog
- SearchBox.tsx (385, ⚠1): isSearchInput, focusSearch, SearchBox
- SearchFilterPanel.tsx (69): SearchFilterPanel
- SearchOverlay.tsx (91): SearchOverlay
- SearchSplit.tsx (48): SearchSplit
- Segmented.tsx (66, ⚠1): Segmented
- ShareButton.tsx (49): shareLink, ShareButton
- StepIcon.tsx (28): STEP_ICONS, StepIcon
- SubtopicIcon.tsx (81, ⚠1): SubtopicIcon
- TierNotice.tsx (74): AccountLoading, LoginRequired, UsagePill
- TopicSeed.tsx (11): TopicSeed
- WheelList.tsx (42): WheelList
- icons.tsx (193): IconSearch, IconPin, IconX, IconChevronDown, IconViewFull, IconViewCompact, IconCalendar, IconChevronRight, IconChevronLeft, IconCheck, IconPlus, IconMinus, IconCenter, IconReset, IconArrowUp, IconUser, IconBookmark, IconEmptySearch, IconDoc, IconRules, IconBell, IconFilter, IconStar, IconHeart, IconDownload, IconCalendarSync, ThemeIcon

### components/ratsmonitor/components/map/
- MapPanel.tsx (348, ⚠2): MapPanel

### components/ratsmonitor/components/results/
- ArticleCard.tsx (174, ⚠2): ArticleCard, StepTimeline
- ResultsPanel.tsx (276): ResultsPanel

### components/ratsmonitor/components/
- suggestRows.ts (214): Row, takePickedText, RowContext, buildRows

### components/ratsmonitor/info/
- AccountPages.tsx (769): LoginPage, ConfirmLoginPage, UnsubscribePage, RegisterPage, KontaktPage
- AgbPage.tsx (182, ⚠15): AgbPage
- AnwenderLive.tsx (173, ⚠2): AnwenderLivePage
- BenachrichtigungenPage.tsx (95): BenachrichtigungenPage
- BranchenLive.tsx (244): LiveThumb
- BranchenPages.tsx (121): BranchePage
- ConnectPage.tsx (142): ConnectPage
- FaqPage.tsx (45, ⚠1): FaqPage
- InfoPages.tsx (51): InfoPages
- KuendigenPage.tsx (212, ⚠1): KuendigenPage
- LegalText.tsx (20): H2, P, Ul
- NotFoundPage.tsx (30): NotFoundPage
- PreisePage.tsx (100, ⚠1): PreisePage
- QuellenPage.tsx (174, ⚠3): QuellenPage
- StartseitePage.tsx (513, ⚠1): StartseitePage
- TodoControls.tsx (139, ⚠12): TodoChoice, TodoOwner, TodoPriorityChoice, TodoStatusChoice, TodoOrder, TodoEditor
- TodoPage.tsx (267, ⚠25): TodoPage
- VideosPage.tsx (172): VideosPage
- WiderrufPage.tsx (79): WiderrufPage
- XAuszug.tsx (220, ⚠2): XAuszug
- anwender-beispiele.ts (37, ⚠21): BEISPIELE
- blocks.tsx (258, ⚠1): useOpenSearch, PageHead, SearchTermButton, HitPreview, DarkCta, QaItem, Ladefehler, InfoHints
- branchen-enterprise.ts (111, ⚠1): AnalyseId, AnalyseGruppe, GRUPPEN, ANALYSEN, NEU_HREF, NEU_NAME, PLENARAX_VORTEILE, EnterpriseBlock, ENTERPRISE
- content.ts (207, ⚠30): Status, Example, Branche, Qa, FAQ, PRICE_FAQ, BRANCHEN, brancheBySlug
- icons.tsx (128): IconName, Icon
- useTodoBoard.ts (208, ⚠2): TodoPatch, TodoCreate, useTodoBoard

### components/ratsmonitor/lib/
- account.ts (313): Me, getMe, AccountApiError, api, touchAccount, reloadMe, accountChanged, logout, setViewTier, devLogin, useMe, onMe, shortDate
- bandFigure.ts (32, ⚠1): publishBandFigure, useBandFigure, useCountUp
- betreiber.ts (20): BETREIBER, betreiberAdresse
- booking.ts (22): BOOK_PATH, Bookable, bookHref, usePlusLink
- brand.ts (52): setLogo, useBrand, useBrandText
- brands.ts (45): BrandId, BRAND_NAME, LogoId, LOGOS, LOGO_IDS, DEFAULT_LOGO, DEFAULT_BRAND, pageTitle
- browserData.ts (283): WEEK_DAYS, LocalArticle, LocalData, ImportPayload, ImportResult, useLocalData, hasLocal, shouldAsk, postponeImport, localSummary, buildPayload, downloadFile, saveLocalFile, importLocal, discardLocal, importFile, resultText
- calendarAreas.ts (35): CalArea, areaOwners, calendarAgs, cleanAreas
- catalog.ts (22): loadCatalog, useCatalog
- clipboard.ts (26): copyText
- constants.ts (63, ⚠1): THEMEN, shownThema, StatusInfo, STATUS, STATUS_BY_ID, MAP_COLORS, MAP_COLORS_DARK, colorForCoverageDark, colorForCoverage, STATUS_COLOR
- entitlements.ts (49): useEntitlements
- favicon.ts (39, ⚠1): setFavicon
- fetchJson.ts (44): ApiError, fetchJson, readJson, fetchOrFail, errorText
- filter.ts (25): FilterSpec, FilterKey, matches
- filtersOpen.ts (19): setFiltersOpen, useFiltersOpen
- format.ts (7): nf, num, pctText

### components/ratsmonitor/lib/geo/
- geoModel.ts (361): BBox, Layer, HierEntry, AreaInfo, decodeArc, GeoModel
- mapEngine.ts (1145): MapEngineCallbacks, MapStyle, MapEngine

### components/ratsmonitor/lib/
- haptic.ts (5): tick
- homePlace.ts (39): HomePlace, useHomePlace
- iconStroke.ts (3): iconStroke
- listView.ts (47): ListView, setListView, useListView
- mapSlot.ts (18): setMapSlot, clearMapSlot, useMapSlot
- methodikHost.ts (8): setMethodikHost, useMethodikHost
- otherTab.ts (11): onOtherTab
- pageTitle.ts (43): tabTitle
- place.ts (313, ⚠1): PlaceEntry, PlaceHit, ParseResult, SuggestResult, regionSuggest, regionsIn, PlaceIndex, removePhrase
- queue.ts (29): queue
- radioKeys.ts (18): radioKeys, radioTab
- recentSearches.ts (32): readRecent, addRecent, clearRecent
- reportError.ts (28): reportError, installErrorReporting
- routes.ts (10): INFO_PATHS, ANALYTICS_PATHS, brancheOf, isInfoPath, isAnalyticsPath
- savedArticles.ts (168): SavedArticle, toggleSavedArticle, setArticleFollow, removeSavedArticle, restoreSavedArticle, useSavedArticles, useSavedArticlesReady
- savedSearch.ts (155, ⚠1): SearchSnapshot, snapshotOf, signature, queryText, canonicalQuery, hasFilters, FilterChip, filterChips, RangePreset, RANGE_PRESETS, presetOf, resolveRange, rangeLabel, hasScope, splitTerms, suggestName
- searchLogic.ts (111): Parse, applySearchState, commitPlacesState, isReplacement, withoutFilters, clearAreaState, deriveFilters
- searchUrl.ts (106): readableQuery, searchToUrl, onlyText, searchFromUrl
- sheetStage.ts (26): SheetStage, setSheetStage, toggleSheetStage, useSheetStage, setPeekHidden, usePeekHidden
- signedInHint.ts (7): SignedInHint, useSignedInHint
- subParam.ts (17): useSubParam
- terms.ts (24, ⚠2): isFiller, prettyTerm, termStem
- text.ts (96): norm, terms, Segment, highlightSegments, plural, fmtDate, isoDay, todayLocal, MONTH_SHORT, monthLabel
- tier.ts (105): Tier, Freq, TierLimits, LIMITS, PLAN_MAX, TIER_LABEL, BOOKABLE, OFFERED, rankOf, nextTier, tierFor, unlimited, countLabel, FREQ_LABEL, freqsLabel, freqIn, priceLabel, priceShort, UPGRADE_TEXT, IS_DEV, getTier, setTier, useTier, usage
- todos.ts (118): TodoStatus, TodoPersonId, TodoResolution, TodoPriority, TodoSubtask, TODO_STATUSES, TODO_PRIORITIES, TODO_RESOLUTIONS, TODO_PEOPLE, TodoItem, TodoCategory, TodoData, taskStatus, todoPriority, taskResolution, normalizeTodoItem, TodoKind, TodoState, localToday, fmtShort, todoState
- topicCache.ts (43): TopicError, seedTopic, peekTopic, loadTopic, prefetchDetail
- useClient.ts (12): useClient, useHydrated
- useDarkMode.ts (40): useDarkMode
- useDwell.ts (19): useDwell
- useInstall.ts (27): isStandalone, useInstall
- useLongPress.ts (32): useLongPress
- usePhone.ts (30): PHONE_QUERY, isPhone, usePhone, useTinyPhone
- useRailFold.ts (44): useRailFold, useRailPeek
- useScrollMemory.ts (49): useScrollMemory
- useSwipe.ts (35): useSwipe
- uuid.ts (12): newId
- viewClamp.ts (18): NetViewState, NetBox, clampView

### components/ratsmonitor/menu/
- MainMenu.tsx (295, ⚠1): ANWENDER, XEintrag, ANALYSE, EINBLICKE, HINTERGRUENDE, INFO, MainMenu
- MeinSheet.tsx (29): MeinSheet
- MoreSheet.tsx (41, ⚠1): MoreSheet
- SegTiles.tsx (25): Segmented, Tile
- Sheet.tsx (97, ⚠1): Sheet
- XSwitcher.tsx (34): XSheet

### components/ratsmonitor/pages/
- BookingPage.tsx (113): BookingPage
- DetailPage.tsx (224, ⚠17): DetailPage
- KalenderPage.tsx (443, ⚠3): KalenderPage
- LegalPage.tsx (287): useInhalt, LegalPage
- NotificationsPage.tsx (93, ⚠2): NotificationsPage
- OverviewPage.tsx (174): OverviewPage
- PersonalPage.tsx (30): PersonalPage
- PostfachPage.tsx (64): PostfachPage
- ProfilePage.tsx (454): ProfilePage
- SavedArticlesPage.tsx (156, ⚠3): SavedArticlesPage
- SavedSearchesPage.tsx (304, ⚠2): SavedSearchesPage, WeeklyReport
- WillkommenPage.tsx (60): WillkommenPage

### components/ratsmonitor/pages/analytics/
- AnalyticsAbout.tsx (232, ⚠18): ANALYSE_THUMBS, MethodikText
- AnalyticsLocked.tsx (54): AnalyticsLocked
- AnalyticsPages.tsx (64): AnalyticsPages
- AtlasMap.tsx (108, ⚠2): AtlasMap
- AtlasPage.tsx (100): AtlasPage
- AtlasParts.tsx (187, ⚠2): Row, Result, Fact, n, MIN_BASE, isRest, restLast, Bars, Hint, OrtImVergleich, Level, AtlasExtra, PartList, PlaceChip
- Befund.tsx (84): Befund, zuThema, Leer, Fehler
- BeschluessePage.tsx (239, ⚠13): BeschluessePage
- CompareCharts.tsx (69, ⚠2): PLACE_COLORS, CompareLines, TopicPair
- CompareFields.tsx (71): FIELD, PlaceField
- ComparePage.tsx (382, ⚠11): ComparePage
- CompareParts.tsx (74, ⚠3): Share, Place, Result, ORT, asPlace, n, inhaltlich, datenlage, Hinweis, Duell
- DecisionCharts.tsx (66, ⚠2): DEC_COLORS, Cut, Month, MonthColumns, DecisionRow
- DiffusionSearch.tsx (99, ⚠2): PlayState, DiffusionSearch
- FaktenPage.tsx (416, ⚠6): FaktenPage
- FraktionenPage.tsx (264, ⚠9): FraktionenPage
- GraphView.tsx (389, ⚠2): GNode, GEdge, KIND, seeded, GraphView
- GremiennetzPage.tsx (220, ⚠4): GremiennetzPage
- Kennzahlen.tsx (125): weekAgo, Kennzahlen, countScale, zeitText, ZeitExtra, ZeitPills, useOrtInAdresse, Folgen
- KnowledgeGraphPage.tsx (319, ⚠9): KnowledgeGraphPage
- Laden.tsx (32): Laden
- ListRow.tsx (34, ⚠1): ListRow
- ListSkeleton.tsx (13): ListSkeleton
- ListenKopf.tsx (28): ListenKopf, Reiter
- MapHint.tsx (23): MapHint
- MapWheels.tsx (122, ⚠3): MapWheels, MapPill
- Methodik.tsx (43): MethodikUnten, MethodikNote
- NetControls.tsx (50): Level, netLevel, LevelSegmented, LevelPill, NetLegend, NetZoom
- NetView.tsx (321): NNode, NEdge, ROLE, NetKind, NET_KIND, NetView
- NewsradarPage.tsx (161): NewsradarPage
- PageBand.tsx (23): PageBand
- RadarDrill.tsx (131, ⚠3): DrillItem, RadarDrill
- RadarThumbs.tsx (123): RADAR_THUMBS
- RailToggle.tsx (34): RailToggle
- RegionMap.tsx (184, ⚠5): RegionMap
- Reveal.tsx (16): Reveal
- SignalePage.tsx (436, ⚠17): SignalePage
- SplitHandle.tsx (53): SplitHandle
- Tabs.tsx (7): TabPane
- TrendViews.tsx (72, ⚠1): Trend, TrendKind, Spark, TrendMap
- XAtlasView.tsx (293, ⚠9): XAtlasView
- XBusy.tsx (14): busyProps, PendingVeil, HERO_MAIN, HERO_PANEL
- XKopf.tsx (235, ⚠2): XKopf, XWeiter, ThemenLeiste
- XTrendsPage.tsx (373, ⚠6): XTrendsPage
- XTrendsParts.tsx (153, ⚠1): DAY, toDay, fmt, SpreadRegion, keysOf, SpreadMap, SpreadChart, MiniCurve
- useAnalysisRun.ts (70): useAnalysisRun
- useAnalyticsQuery.ts (88): useAnalyticsQuery

### components/ratsmonitor/services/
- api.ts (7, ⚠1): SAVED_SEARCHES_KEY, readSavedSearches

### components/ratsmonitor/state/
- account.tsx (108): AccountProvider, useAccount, useSavedStats
- data.tsx (42, ⚠1): DataProvider, useData
- nav.ts (24, ⚠1): View, noteRoute, cameFromApp, rememberSearchHref, lastSearchHref, overviewScroll, useAppNav
- search.tsx (676, ⚠4): INITIAL_SEARCH, SearchProvider, useSearch, CoverageEntry, SearchResults, savedSearchQuery, useSearchResults
- toast.tsx (66): ToastProvider, useToast
- ui.tsx (29): UiProvider, useUi

### components/ratsmonitor/
- types.ts (130): StatusId, ArticleData, Article, MapLayerData, MapData, AreaSource, Radius, SearchState, NotifyFreq, SavedSearch

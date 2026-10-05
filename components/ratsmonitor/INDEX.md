# Frontend-Index (erzeugt, nicht von Hand ändern)

Neu erzeugen: `node scripts/frontend-index.mjs`. Ergänzt `FRONTEND.md` (Wo ist was?) um Dateien, Exporte und CSS-Klassen mit Zeilennummer.
`⚠N` = N Zeilen über 300 Zeichen: dort nicht ganze Zeilen lesen, sondern mit `grep -o` oder `grep -n` gezielt suchen.

## CSS-Klassen (Klasse:Zeile)

### app/analyse-admin.css (176 Zeilen, ⚠23)
wordmark:5 skip-link:6 topic__title:7 article__title:7 docs__name:7 topic-image:8 load-more:9 feed-message:10 process-note:11 export-footer:12 notification-panel:13 setting:13 notice:13 tag:14 tabs:14 topic__footer:14 topic__meta:14 prose:15 section--text:15 article__status:16 process__label:17 tabs__tab:20 masthead__meta:22 masthead__status:22 timeline__date:23 timeline__item:23 region-picker:25 region-trigger:25 related-topics:26 related-count:26 comparison-counts:26 comparison-warning:26 related-group:26 related-method:26 related-item:26 region-sources:26 analysis-screen:29 analysis-main:29 analysis-heading:29 eyebrow:29 analysis-controls:29 analysis-field:29 analysis-apply:29 analysis-context:29 analysis-notice:29 analysis-grid:29 analysis-panel:29 distribution-row:29 is-selected:29 distribution-name:29 distribution-value:29 distribution-track:29 trend-chart:29 table-scroll:29 analysis-table:29 analysis-details:29 analysis-method:29 map-inspector:29 comparison-result:29 map-heading:29 analysis-big-number:29 map-tools:29 map-layout:29 germany-map:29 map-value:29 heat-legend:29 no-data-swatch:29 map-place-buttons:29 map-attribution:29 page-note:29 tabbar:29 region-search-trigger:33 region-search-popover:34 source-filter:38 analysis-examples:42 examples-heading:42 example-links:42 example-unavailable:42 example-number:42 example-detail:42 example-result:42 example-answer:42 example-subjects:44 concrete-examples:44 concrete-grid:44 concrete-card-heading:44 concrete-action:44 more-concrete:44 monthly-mix:46 mix-heading:46 mix-bars:46 mix-month:46 mix-month-name:46 mix-month-state:46 mix-stack:46 mix-segment:46 selected:46 mix-gap:46 mix-legend:46 mix-changes:46 mix-values:46 mix-delta:46 mix-jump:46 analysis-basic:48 analysis-advanced:48 analysis-advanced-fields:48 analysis-focus:48 analysis-submit:48 analysis-options:48 analysis-counting:48 analysis-jumps:48 trend-scroll:48 tabbar__item:48 analysis-region:49 map-region:51 region-option-text:54 region-data-badge:55 has-data:56 no-data:57 region-trigger-count:58 region-data-hint:59 admin-shell:65 admin-topbar:66 admin-access:66 admin-heading:66 admin-gate:66 admin-refresh:66 admin-kpis:66 admin-kpi:66 admin-kpi-primary:66 admin-nav:66 admin-attention:66 admin-section:66 admin-section-heading:66 admin-download:66 admin-source-controls:66 admin-field:66 admin-note:66 admin-table:66 admin-number:66 admin-strong:66 admin-state:66 needs-attention:66 admin-source-issues:66 admin-row-actions:66 admin-empty:66 admin-notice:66 admin-error:66 admin-quality-stats:66 admin-charts:66 admin-bar-row:66 admin-bar:66 admin-status-row:66 admin-explainer:66 admin-review-head:66 admin-review-list:66 admin-operations:66 admin-footer:66 text-link:66 admin-gate-action:66 admin-activation:66 admin-spin:66 map-view-controls:71 map-scope:71 map-question:71 map-periods:71 map-period-arrow:71 map-workspace:71 map-completeness:71 map-canvas:71 map-canvas-note:71 map-value-text:71 map-inspector-links:71 map-comparison-values:71 map-key:71 map-key-missing:71 map-data-table:71 map-table-select:71 map-matches-heading:71 deferred-map:73 map-loading:73 analysis-provenance:76 session-details:76 keyword-list:76 admin-pages:79 admin-workspace:79 admin-territories:79 admin-selection-actions:79 admin-geography:79 admin-map:79 admin-map-canvas:79 admin-map-region:79 admin-map-hover:79 admin-map-legend:79 admin-region-list:79 admin-list-meta:79 admin-source-list:79 admin-source-item:79 admin-source-meta:79 admin-pipeline:79 admin-job:79 admin-storage-status:79 admin-stage-grid:79 admin-stage:79 admin-stage-number:79 admin-stage-ai:79 admin-ai-kinds:79 admin-ai-retry:79 admin-job-results:79 screen:84 masthead:84 legacy-tools:84 admin-timeline:85 admin-timeline-controls:85 admin-timeline-charts:85 admin-timeline-retry:85 admin-timeline-table:85 admin-estimate:87 admin-estimate-table:87 admin-estimate-basis:87 is-assumed:87 is-thin:87 is-none:87 admin-estimate-subheading:87 admin-estimate-class:87 admin-estimate-action:87 admin-estimate-assumptions:87 admin-estimate-step:88 admin-estimate-formula:88 admin-estimate-charts:88 admin-estimate-figure:88 admin-estimate-key:88 is-stored:88 is-sample:88 admin-estimate-share:88 is-model:88 admin-estimate-wrap:88 admin-estimate-tag:90 is-counted:90 admin-estimate-tags:90 admin-estimate-facts:90 admin-estimate-explain:90 is-line:90 admin-run-debug:92 admin-run-debug-panel:92 is-failed:92 admin-run-debug-requests:92 admin-run-debug-actions:92 is-open:94 admin-terms-columns:96 admin-terms:96 admin-terms-table:96 admin-terms-search:96 admin-terms-stats:96 admin-terms-chips:96 page-error-action:98 admin-app:102 admin-masthead:103 admin-masthead__inner:104 admin-masthead__account:106 admin-job-progress:159 admin-job-counts:160 admin-germany:163 admin-germany-text:165 admin-germany-lands:166 admin-germany-action:172

### app/design-fonts.css (71 Zeilen)


### app/design-styles.css (310 Zeilen)
icon:22 screen:32 page:41 page-note:43 section-title:46 heading-m:51 wordmark:59 wordmark--l:60 wordmark__dot:61 button:65 button--primary:76 text-link:79 share-button:89 tag:106 tag--final:118 steps:121 steps__bar:122 steps__bar--done:123 process:126 process__step:127 process__bar:128 process__step--open:129 process__label:130 masthead:135 masthead__row:136 masthead__meta:137 masthead__place:138 masthead__status:139 tabs:142 tabs__tab:143 topic:158 topic__kicker:159 topic__title:160 topic__teaser:169 topic__footer:170 topic__state:171 topic__status:172 topic__meta:173 topic--lead:177 sessions:183 session:184 session__date:186 session__day:188 session__body:189 session__title:190 session__topic:191 empty-state:194 empty-state__title:195 empty-state__text:196 tabbar:199 tabbar__item:213 onboarding:229 onboarding__brand:230 onboarding__place:231 onboarding__title:232 onboarding__intro:240 explainer:241 explainer__text:242 onboarding__actions:243 onboarding__source:244 facts:248 facts__row:249 figure:253 prose:257 timeline:260 docs:263 setting:267 setting__label:268 setting__name:269 setting__hint:270 switch:273 notice:301 section:305 legend:307

### app/design-tokens.css (75 Zeilen)


### app/globals.css (12 Zeilen, ⚠2)


### app/ratsmonitor-info.css (388 Zeilen, ⚠9)
ri:13 ri-menu:13 ri-menu__panel:17 ri-btn:21 ri-btn--dark:22 ri-btn--light:24 ri-btn--inv:26 ri-btn--block:28 ri-actions:29 ri-head:32 ri-head__grid:33 ri-head__grid--top:34 ri-bid:35 ri-bid__icon:36 ri-bid__label:37 ri-bid__name:38 ri-h1:39 ri-h1--sm:40 ri-lead:41 ri-for:42 ri-sec:45 ri-sec--tight:46 ri-sec--faq:47 ri-h2:48 ri-h2--md:49 ri-sub:50 ri-eyebrow:51 ri-band:54 ri-grid3:55 ri-bcard:56 ri-bcard__icon:57 ri-tl:62 ri-tl__step:64 ri-tl__icon:65 ri-tl__step--out:66 ri-tl__label:67 ri-tl__title:69 ri-vp:73 ri-vp__label:74 ri-vp__text:75 ri-vp__stats:76 ri-vp__num:77 ri-vp__lab:78 ri-vp__note:79 ri-wr:82 ri-wr__sep:83 ri-dark:86 ri-dark__row:87 ri-dark__sub:89 ri-pills:90 ri-pill:91 ri-darkbox:93 ri-pv:98 ri-pv__note:99 ri-pv__bell:100 ri-pv__title:101 ri-pv__meta:102 ri-pv__card:103 ri-pv__row:104 ri-pv__comm:105 ri-st:106 ri-pv__h:107 ri-pv__lines:108 ri-pv__foot:111 ri-place:112 ri-st--ok:115 ri-st--wait:116 ri-pv2:119 ri-pv2__search:120 ri-pv2__item:121 ri-pv2__row:123 ri-pv2__h:124 ri-pv2__meta:125 ri-stats:129 ri-stat:130 ri-stat__num:131 ri-stat__lab:132 ri-two:133 ri-points:135 ri-point:136 ri-point__num:137 ri-mint:140 ri-faq-group:144 ri-faq-group__label:145 ri-faq-list:146 ri-faq-list--top:147 ri-qa:148 ri-qa__sign:152 ri-qa__sign--minus:153 ri-qa__sign--plus:153 ri-qa__a:155 ri-qa__a--todo:156 ri-grid4:159 ri-bc:160 ri-bc__icon:162 ri-bc__benefit:164 ri-bc__for:165 ri-bc__more:166 ri-sec--prices:169 ri-prices:170 ri-pk:171 ri-pk--hl:172 ri-pk__badge:173 ri-pk__desc:175 ri-pk__price:176 ri-pk__amount:177 ri-pk__unit:178 ri-pk__note:179 ri-pk__hr:180 ri-pk__items:181 ri-checks:182 ri-pk__label:184 ri-pk__cta:188 ri-h2--gap:190 ri-table:191 ri-table__first:197 ri-form:200 ri-form--center:201 ri-field:202 ri-field__label:203 ri-input:204 ri-help:210 ri-err:211 ri-check:212 ri-link:214 ri-submit:216 ri-form__foot:217 ri-plans:218 ri-plan:219 ri-plan__name:222 ri-plan__price:223 ri-chosen:224 ri-chosen__head:225 ri-chosen__name:226 ri-chosen__price:227 ri-chosen__change:230 ri-done:233 ri-done__icon:234 ri-proto:238 ri-legal:241 rm-logo:246 rm-logo__text:248 ri-burger:251 ratsmonitor:254 ri-menu__bg:256 ri-menu__head:258 ri-logo:259 ri-logo__mark:260 ri-menu__close:261 ri-menu__nav:263 ri-menu__label:264 ri-menu__main:265 ri-menu__subs:268 ri-menu__sub:269 ri-head--compact:327 ri-menu__label--sep:337 ri-menu__start:338 ri-points--2:340 ri-menu__group:360 ri-menu__chev:362 ri-topnav:380 ri-menu__panel--flyout:385

### app/ratsmonitor.css (136 Zeilen, ⚠5)
ratsmonitor:2 btn-primary:5 btn-secondary:8 btn-sm:11 btn-danger:14 link-btn:17 back-btn:20 field-input:25 field-label:28 field-help:31 field-error:34 select-base:37 select-active:40 card-shell:45 chip-soft:48 badge-new:51 count-pill:54 popover:57 scroll-thin:60 admin-shell:67 admin-gate:67 admin-stage-number:67 admin-pages:67 eyebrow:67 admin-stage:67 admin-map:67 admin-job:67 admin-stage-ai:67 wordmark:67 analysis-provenance:67 prose:67 heading-m:67 facts__row:67 page-note:67 admin-kpi-primary:73 admin-kpis:75 admin-source-item:76 is-selected:76 admin-topbar:77 admin-footer:79 admin-workspace:87 admin-source-controls:87 admin-back:92 font-bold:98 font-semibold:99 font-medium:100 rm-flat:106 rm-glass:115 text-link:120 rm-glass-pop:124 bg-teal-50:125 rm-chip:134

## Dateien (Zeilen, Exporte)


### app/(monitor)/agb/
- page.tsx (2): Page

### app/(monitor)/anmelden/
- page.tsx (2): Page

### app/(monitor)/beschluss/[id]/
- page.tsx (21): generateMetadata, Page

### app/(monitor)/branchen/[slug]/
- page.tsx (2): Page

### app/(monitor)/datenschutz/
- page.tsx (2): Page

### app/(monitor)/faq/
- page.tsx (2): Page

### app/(monitor)/funktionen/benachrichtigungen/
- page.tsx (2): Page

### app/(monitor)/funktionen/suche/
- page.tsx (2): Page

### app/(monitor)/impressum/
- page.tsx (2): Page

### app/(monitor)/kontakt/
- page.tsx (2): Page

### app/(monitor)/konto/[[...section]]/
- page.tsx (3): Page

### app/(monitor)/
- layout.tsx (3): MonitorLayout
- page.tsx (2): Page

### app/(monitor)/preise/
- page.tsx (2): Page

### app/(monitor)/quellen/
- page.tsx (2): Page

### app/(monitor)/registrieren/
- page.tsx (2): Page

### app/(monitor)/thema/[id]/
- page.tsx (2): Page

### app/(monitor)/ueber-ratsmonitor/
- page.tsx (2): Page

### app/(monitor)/ueber-uns/
- page.tsx (2): Page

### app/abgemeldet/
- page.tsx (2)

### app/admin/
- page.tsx (32, ⚠1): dynamic, metadata, AdminPage

### app/analysen/
- page.tsx (5): Page

### app/
- chatgpt-auth.ts (95): ChatGPTUser, getChatGPTUser, requireChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath
- error.tsx (7, ⚠1): PageError
- global-error.tsx (9, ⚠1): GlobalError
- layout.tsx (6, ⚠1): metadata, RootLayout

### app/thema/[id]/
- related-topics.tsx (11, ⚠3): RelatedTopics

### app/ueber/
- page.tsx (5, ⚠1): About

### components/
- admin-activation.tsx (9, ⚠1): AdminActivation
- admin-chrome.tsx (22): AdminBar, AdminHeader
- admin-dashboard.tsx (79, ⚠19): AdminDashboardView
- admin-estimate.tsx (332, ⚠51): AdminEstimate
- admin-forecast.tsx (12): AdminForecast
- admin-keywords.tsx (88, ⚠13): AdminKeywords
- admin-loader.tsx (29, ⚠1): AdminLoader
- admin-processing-map.tsx (33, ⚠4): AdminProcessingMap
- admin-processing.tsx (157, ⚠25): AdminProcessing
- admin-run-debug.tsx (67, ⚠3): RunDebugView, AdminRunDebug
- admin-timeline.tsx (72, ⚠6): AdminTimeline
- analysis-article-list.tsx (34, ⚠1): AnalysisArticleList
- analysis-controls.tsx (17, ⚠4): AnalysisControls
- analysis-examples.tsx (16, ⚠5): AnalysisExamples
- article-analysis.tsx (17, ⚠6): ArticleAnalysis, SessionDetails
- database-admin.tsx (28, ⚠3): DatabaseAdmin
- deferred-map.tsx (22, ⚠1): DeferredMap
- germany-heatmap.tsx (64, ⚠12): GermanyHeatmap
- monthly-mix.tsx (16, ⚠4): MonthlyMix
- news-feed.tsx (32, ⚠1): NewsFeed
- notifications.tsx (10, ⚠3): Notifications
- process-progress.tsx (8, ⚠1): ProcessProgress

### components/ratsmonitor/
- App.tsx (25, ⚠1): MonitorApp

### components/ratsmonitor/components/
- AccountMenu.tsx (62, ⚠1): AccountMenu
- ActiveFilters.tsx (116): ActiveFilters
- AreaBar.tsx (91, ⚠1): AreaBar
- Brand.tsx (236): Brand
- DateRangeFilter.tsx (71): DateRangeFilter
- DevBrandSwitcher.tsx (30): DevBrandSwitcher
- DevTierSwitcher.tsx (25): DevTierSwitcher
- ExportMenu.tsx (55, ⚠1): ExportOption, ExportMenu
- FilterPanel.tsx (93): FilterPanel
- FilterSelect.tsx (98): FilterSelect
- FollowButton.tsx (30): FollowButton
- Footer.tsx (59): Footer
- GateDialog.tsx (127): GateFeature, openGate, GateDialog
- Header.tsx (32): Header
- PlanCards.tsx (97): PlanCards
- SaveArticleButton.tsx (27): SaveArticleButton
- SaveSearchDialog.tsx (15, ⚠2): SaveSearchDialog
- SearchBox.tsx (377): SearchBox
- SearchFilterPanel.tsx (80): SearchFilterPanel
- SearchOverlay.tsx (88): SearchOverlay
- ShareButton.tsx (39): ShareButton
- TierNotice.tsx (46): LoginRequired, UsagePill
- icons.tsx (229): IconSearch, IconPin, IconTag, IconX, IconChevronDown, IconViewFull, IconViewCompact, IconCalendar, IconChevronUp, IconMap, IconChevronRight, IconChevronLeft, IconCheck, IconPlus, IconMinus, IconCenter, IconReset, IconArrowUp, IconUser, IconBookmark, IconHelp, IconLogout, IconMail, IconPhone, IconClock, IconReply, IconRadius, IconEmptySearch, IconBrand, IconDoc, IconBell, IconFilter, IconHeart, IconDownload, IconCalendarSync

### components/ratsmonitor/components/map/
- MapPanel.tsx (299, ⚠1): MapPanel

### components/ratsmonitor/components/results/
- ArticleCard.tsx (179, ⚠1): Highlight, StatusBadge, ArticleCard, StepTimeline
- ResultsPanel.tsx (158): ResultsPanel

### components/ratsmonitor/info/
- AboutPage.tsx (164): AboutPage
- AccountPages.tsx (334, ⚠1): DoneScreen, RegisterPage, LoginPage, KontaktPage
- BenachrichtigungenPage.tsx (77): BenachrichtigungenPage
- BranchenPages.tsx (86): BranchePage
- FaqPage.tsx (45, ⚠1): FaqPage
- InfoPages.tsx (65): isInfoPath, InfoPages
- PreisePage.tsx (91): PreisePage
- QuellenPage.tsx (107, ⚠1): QuellenPage
- UeberUnsPage.tsx (65): UeberUnsPage
- blocks.tsx (199): useOpenSearch, Rich, PageHead, SearchTermButton, StatusPill, PlacePill, HitPreview, DarkCta, QaItem
- content.ts (379, ⚠12): Status, Example, Branche, STATUS_LABEL, BRANCHEN, NOTIFY_STAT, Qa, FAQ, PRICE_FAQ, PlanId, Rich, Plan, PLANS, COMPARE, AGB_SECTIONS, brancheBySlug
- icons.tsx (110): IconName, Icon

### components/ratsmonitor/lib/
- brand.ts (54): setLogo, useBrand, useBrandText, brandName
- brands.ts (45): BrandId, BRAND_NAME, LogoId, LOGOS, LOGO_IDS, DEFAULT_LOGO, DEFAULT_BRAND, PAGE_TAGLINE, pageTitle
- constants.ts (37, ⚠1): THEMEN, StatusInfo, STATUS, STATUS_BY_ID, TEASER_MAX_SENTENCES, isCovered, MAP_COLORS, colorForCoverage, colorForCount
- entitlements.ts (41): useEntitlements
- exportArticle.ts (403): ArticleExport, exportArticleTable, printArticle, exportArticlePdf
- exportResults.ts (32): EXPORT_MAX, ExportFormat, exportResults
- filter.ts (35): FilterSpec, FilterKey, matches, addCount, countBy
- filtersOpen.ts (19): setFiltersOpen, useFiltersOpen

### components/ratsmonitor/lib/geo/
- geoModel.ts (360): BBox, Layer, HierEntry, AreaInfo, decodeArc, GeoModel
- mapEngine.ts (970): MapEngineCallbacks, MapStyle, MapEngine

### components/ratsmonitor/lib/
- iconStroke.ts (3): iconStroke
- listView.ts (34): ListView, setListView, useListView
- mails.ts (134, ⚠1): MailItem, p, h, button, more, items, sendMail, welcomeMail, resetMail, DigestPart, digestMail, alertMail, followMail, reminderMail
- place.ts (291, ⚠1): PlaceEntry, PlaceHit, ParseResult, SuggestResult, regionSuggest, regionsIn, PlaceIndex, textPart, removePhrase
- savedArticles.ts (65): SavedArticle, toggleSavedArticle, toggleFollow, removeSavedArticle, useSavedArticles
- savedSearch.ts (118): SearchSnapshot, signature, queryText, hasFilters, FilterChip, placeLabel, filterChips, rangeLabel, scopeLabel, hasScope, splitTerms, suggestName
- searchLogic.ts (104): Parse, isCommitted, applySearchState, commitPlacesState, isReplacement, clearAreaState, deriveFilters
- testAuth.ts (142): TestAccount, TestMail, TEST_PASSWORD, sendTestMail, login, register, requestReset, logout, useTestSession, useTestMails, markMailsRead, deleteMails
- text.ts (99): normChar, norm, FILLER, terms, Segment, highlightSegments, limitSentences, plural, parseDate, fmtDate, isoDay, MONTH_FMT, MONTH_SHORT, DAY_FMT, TIME_FMT, monthLabel, EMAIL_RE
- tier.ts (82): Tier, TierLimits, LIMITS, TIER_LABEL, PRO_PRICE, IS_DEV, getTier, setTier, useTier, usage
- xlsx.ts (97, ⚠6): makeXlsx, download, makeCsv

### components/ratsmonitor/menu/
- MainMenu.tsx (183): MainMenu

### components/ratsmonitor/pages/
- DetailPage.tsx (116, ⚠3): DetailPage
- KalenderPage.tsx (358, ⚠3): KalenderPage
- LegalPage.tsx (232): LegalPage
- OverviewPage.tsx (55): OverviewPage
- PersonalPage.tsx (30, ⚠4): PersonalPage
- PostfachPage.tsx (81): PostfachPage
- ProfilePage.tsx (105): ProfileSettings, readProfile, ProfilePage
- SavedArticlesPage.tsx (124, ⚠2): SavedArticlesPage
- SavedSearchesPage.tsx (289): SavedSearchesPage

### components/ratsmonitor/services/
- api.ts (7, ⚠1): readSavedSearches, writeSavedSearches

### components/ratsmonitor/state/
- account.tsx (16, ⚠1): AccountProvider, useAccount, useSavedStats
- data.tsx (34, ⚠1): DataProvider, useData
- nav.ts (13): View, viewOf, overviewScroll, useAppNav
- search.tsx (346, ⚠2): INITIAL_SEARCH, SearchProvider, useSearch, CoverageEntry, SearchResults, useSearchResults
- toast.tsx (66): ToastProvider, useToast
- ui.tsx (29): UiProvider, useUi

### components/ratsmonitor/
- types.ts (126): StatusId, ArticleData, Article, MapLayerData, MapData, AreaSource, Radius, SearchState, NotifyFreq, SavedSearch, Profile

### components/
- region-picker.tsx (4, ⚠1): RegionPicker
- region-select.tsx (10, ⚠1): RegionAvailability, RegionSelect
- site-chrome.tsx (6, ⚠2): Header, Footer
- source-region-filter.tsx (5, ⚠1): SourceRegionFilter
- whatsapp.tsx (5, ⚠1): WhatsApp

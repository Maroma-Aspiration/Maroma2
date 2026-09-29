# Maroma Website Progress Report

**Reporting period:** 15-22 September 2026  
**Prepared:** 22 September 2026  
**Production site:** https://maromashopping.com

## Executive summary

The main completed work during this period was the mobile storefront refinement and the creation of a production Video ID workflow for identifying product videos and publishing them to Firebase. The Video ID workflow is now deployed and supports folder loading, video previews, full-catalogue search, ranked likely-product suggestions, product selection, and Firebase publishing.

The product videos themselves have not all been identified and published yet. That remains an operational task using the new admin page.

## Work completed

### Mobile storefront and homepage

- Refined the mobile header search bar and hamburger controls.
- Reduced mobile outline weights and removed the hamburger menu frame.
- Reduced the hamburger icon stroke and adjusted its horizontal position.
- Moved the basket item badge to the lower-right of the basket icon.
- Added a mobile/desktop view toggle to the phone promo layout.
- Added mobile controls for moving the promo strip vertically.
- Increased the mobile text-banner strip height.
- Reduced the gap between Collections and the tile below.
- Adjusted the mobile Collections title position.
- Adjusted the desktop Collections title position.
- Reduced the large mobile gap between collection tiles and Bestsellers.
- Added thumbnail images to the informational cards.
- Added an icon to the personal recommendation control.
- Added and styled a looping mobile carousel for the requested strip.

### Homepage content and media presentation

- Improved mobile promo/background layering so the intended background is visible rather than being covered by the initial background.
- Adjusted promo and collection presentation for mobile spacing and positioning.
- Added image-loading improvements already present in the storefront implementation, including more efficient responsive media handling where supported by the existing code.

### Product video workflow

- Restricted product video uploads to H.264/AAC MP4 files.
- Added the `/admin/video-id` page to the admin area.
- Added folder selection for MP4 videos.
- Added inline video previews.
- Added automatic filename-based catalogue searching when videos are loaded.
- Added full-catalogue searching across product name, SKU, brand, description, categories, and tags.
- Added spelling-tolerant matching, including `moisturising` / `moisturizing` variants.
- Added ranked likely-product results when there is no exact phrase match.
- Added product selection beside each video.
- Added clear status labels: `Not linked`, `Review required`, and `Published`.
- Added a `Link video` action that uploads the selected video to Firebase and attaches it to the chosen product.
- Added `Needs visual confirmation` markers for the videos previously identified as uncertain.
- Added the Video ID page to the admin dashboard.
- Increased Video ID preview videos by 15% to reduce black side bars without modifying source files.

### Deployment

- Deployed the Video ID workflow and subsequent fixes to production.
- Current production admin page: https://maromashopping.com/admin/video-id

## Current status of the original consolidated to-do list

### 1. Reviews and ratings

**Status: Not confirmed complete.** The requested full-width layout, desktop three-column layout, horizontal review scrolling, and presentation improvements still need a dedicated review pass.

### 2. Ingredients

**Status: Not confirmed complete.** The supplied-image replacement, Kokum image replacement, Maroma.com-style redesign, four-card desktop layout, complete ingredient information, product links, and horizontal scrolling still need confirmation or implementation.

### 3. Homepage and Collections

**Status: Partially complete.** Mobile and desktop Collections spacing, title positioning, tile presentation, mobile gaps, and Bestsellers spacing were adjusted. The remaining catalogue/content requirements need confirmation: iPhone image verification, final image-speed audit, removal of random products, true bestselling-product data, square desktop tiles, and final Bestsellers behaviour.

### 4. Mobile

**Status: Partially complete.** Search/header sizing and visibility, hamburger presentation, badge placement, mobile spacing, promo controls, and tap-target presentation were refined. A complete device-by-device iPhone and Android audit is still required.

### 5. Product catalogue and filters

**Status: Not confirmed complete.** The Video ID page now uses the full admin catalogue, but the broader catalogue accuracy audit, latest Maroma.com comparison, filter disappearance checks, and category/filter reconciliation remain outstanding.

### 6. QR and product instruction pages

**Status: Not confirmed complete.** The Asian Delight image/QR correction, instruction text resizing, similar-page consistency, and product-image sizing still require confirmation.

### 7. Video

**Status: Workflow complete; content linking in progress.** MP4 upload handling and the Video ID workflow are deployed. Videos still need to be reviewed, matched to products, and published. Cross-device playback verification is still required after linking.

### 8. Broken links

**Status: Not confirmed complete.** The Join Curations route was addressed in the existing site work, but a complete broken-link audit has not been confirmed in this reporting period.

### 9. Promo page

**Status: Not confirmed complete.** A dedicated Promo page and its approved-asset/content review still require confirmation against the final brief.

## Outstanding priority actions

1. Load the complete MP4 folders into https://maromashopping.com/admin/video-id.
2. Review the automatically ranked product suggestions.
3. Select the correct product for each video and click `Link video`.
4. Resolve the videos marked `Review required` or `Needs visual confirmation`.
5. Test linked videos on iPhone, Android, and desktop.
6. Complete the remaining catalogue, ingredients, reviews, QR-page, broken-link, and Promo-page audits.

## Important distinction

The website code and deployment for the video-identification workflow are complete. That does not mean every source video has already been uploaded, correctly matched, or published to a product. Those final steps require the product-by-product review in the admin page.

## Payment gateway note

- A payment gateway test was completed after meeting with Vani.
- The gateway test indicates that the payment flow was tested, but receipt of the money in the Maroma account has not yet been confirmed.
- Bank/account confirmation is still required before treating the payment integration as fully verified.

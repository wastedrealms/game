// Outbound links for the About / Donate dialog. Centralised so they're trivial to
// swap when migrating from personal accounts to a dedicated Wasted Realms / empires.io
// account later (donations currently go to the personal PayPal — a sole-member LLC).

/** PayPal hosted donate button. The same link is used for every tier — PayPal's own
 *  page lets the donor pick the amount when they open it. */
export const PAYPAL_BUTTON_ID = "GQVB68BJWQMEG";
export const donateUrl = (_amount?: number) =>
  `https://www.paypal.com/donate/?hosted_button_id=${PAYPAL_BUTTON_ID}`;

/** GitHub repo for feedback issues (owner/repo). Links open the issue-form templates
 *  in .github/ISSUE_TEMPLATE/ (labels/title are set by the forms). */
export const GITHUB_REPO = "wastedrealms/game";
const issueTemplate = (file: string) =>
  `https://github.com/${GITHUB_REPO}/issues/new?template=${file}`;
export const ideaUrl = issueTemplate("feedback.yml");
export const bugUrl = issueTemplate("bug.yml");

/** Public site. */
export const SITE_URL = "https://wastedrealms.com";

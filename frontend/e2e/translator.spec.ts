import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/translate/", async (route) => {
    const request = route.request().postDataJSON() as { direction?: string };
    const translation =
      request.direction === "english_to_yeshivish"
        ? "That was mamash a geshmake shiur—gevaldig!"
        : "That was really an enjoyable lesson.";

    await route.fulfill({ json: { translation } });
  });
});

test("translates in both directions and persists the selected theme", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("Yeshivish text").fill("That was mamesh geshmak.");
  await page.getByRole("button", { name: "Translate" }).click();
  await expect(page.getByText("That was really an enjoyable lesson.")).toBeVisible();

  await page.getByRole("button", { name: "English → Yeshivish" }).click();
  await page.getByLabel("English text").fill("That was an enjoyable lesson.");
  await page.getByRole("button", { name: "Translate" }).click();
  await expect(
    page.getByText("That was mamash a geshmake shiur—gevaldig!"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/");

  const lightResults = await new AxeBuilder({ page }).analyze();
  expect(lightResults.violations).toEqual([]);

  await page.getByRole("button", { name: "Dark" }).click();
  const darkResults = await new AxeBuilder({ page }).analyze();
  expect(darkResults.violations).toEqual([]);
});

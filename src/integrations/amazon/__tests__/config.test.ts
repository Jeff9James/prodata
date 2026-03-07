import { describe, it, expect } from "vitest";
import {
  AMAZON_ID,
  AMAZON_NAME,
  AMAZON_COLOR,
  amazonCredentials,
  amazonMetricTypes,
  amazonPermissions,
} from "../config";

describe("Amazon Config", () => {
  it("should have correct integration identifiers", () => {
    expect(AMAZON_ID).toBe("amazon");
    expect(AMAZON_NAME).toBe("Amazon");
    expect(AMAZON_COLOR).toBe("#FF9900");
  });

  describe("credentials", () => {
    it("should require six credential fields", () => {
      expect(amazonCredentials).toHaveLength(6);
    });

    it("should require refresh_token as password", () => {
      const tokenField = amazonCredentials[0];
      expect(tokenField.key).toBe("refresh_token");
      expect(tokenField.type).toBe("password");
      expect(tokenField.required).toBe(true);
    });

    it("should require LWA Client ID", () => {
      const clientIdField = amazonCredentials[1];
      expect(clientIdField.key).toBe("lwa_client_id");
      expect(clientIdField.type).toBe("text");
      expect(clientIdField.required).toBe(true);
    });

    it("should require LWA Client Secret as password", () => {
      const clientSecretField = amazonCredentials[2];
      expect(clientSecretField.key).toBe("lwa_client_secret");
      expect(clientSecretField.type).toBe("password");
      expect(clientSecretField.required).toBe(true);
    });

    it("should require AWS Access Key", () => {
      const accessKeyField = amazonCredentials[3];
      expect(accessKeyField.key).toBe("aws_access_key");
      expect(accessKeyField.type).toBe("text");
      expect(accessKeyField.required).toBe(true);
    });

    it("should require AWS Secret Key as password", () => {
      const secretKeyField = amazonCredentials[4];
      expect(secretKeyField.key).toBe("aws_secret_key");
      expect(secretKeyField.type).toBe("password");
      expect(secretKeyField.required).toBe(true);
    });

    it("should require Marketplace ID", () => {
      const marketplaceField = amazonCredentials[5];
      expect(marketplaceField.key).toBe("marketplace_id");
      expect(marketplaceField.type).toBe("text");
      expect(marketplaceField.required).toBe(true);
    });

    it("should have help URLs for OAuth and AWS setup", () => {
      const tokenField = amazonCredentials[0];
      expect(tokenField.helpUrl).toContain("amazon.com");

      const awsField = amazonCredentials[3];
      expect(awsField.helpUrl).toContain("amazon.com");
    });
  });

  describe("metric types", () => {
    it("should define all expected metric types", () => {
      const keys = amazonMetricTypes.map((m) => m.key);
      expect(keys).toContain("revenue");
      expect(keys).toContain("orders_count");
      expect(keys).toContain("sales_count");
      expect(keys).toContain("products_count");
      expect(keys).toContain("platform_fees");
    });

    it("should format revenue metrics as currency", () => {
      const currencyMetrics = amazonMetricTypes.filter(
        (m) => m.format === "currency"
      );
      const currencyKeys = currencyMetrics.map((m) => m.key);
      expect(currencyKeys).toContain("revenue");
      expect(currencyKeys).toContain("platform_fees");
    });

    it("should format count metrics as number", () => {
      const orders = amazonMetricTypes.find((m) => m.key === "orders_count");
      expect(orders?.format).toBe("number");

      const units = amazonMetricTypes.find((m) => m.key === "sales_count");
      expect(units?.format).toBe("number");

      const products = amazonMetricTypes.find((m) => m.key === "products_count");
      expect(products?.format).toBe("number");
    });
  });

  describe("permissions", () => {
    it("should declare permissions for orders, items, sellers, and catalog", () => {
      const resources = amazonPermissions.map((p) => p.resource);
      expect(resources).toContain("orders");
      expect(resources).toContain("order_items");
      expect(resources).toContain("sellers");
      expect(resources).toContain("catalog");
    });

    it("should require only read access", () => {
      for (const perm of amazonPermissions) {
        expect(perm.access).toBe("read");
      }
    });

    it("should have a reason for every permission", () => {
      for (const perm of amazonPermissions) {
        expect(perm.reason).toBeTruthy();
        expect(perm.reason.length).toBeGreaterThan(0);
      }
    });
  });
});

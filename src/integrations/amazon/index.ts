import { registerIntegration } from "../registry";
import type { IntegrationDefinition } from "../types";
import {
  AMAZON_ID,
  AMAZON_NAME,
  AMAZON_DESCRIPTION,
  AMAZON_ICON,
  AMAZON_COLOR,
  amazonCredentials,
  amazonMetricTypes,
  amazonPermissions,
} from "./config";
import { amazonFetcher } from "./fetcher";

const amazonIntegration: IntegrationDefinition = {
  id: AMAZON_ID,
  name: AMAZON_NAME,
  description: AMAZON_DESCRIPTION,
  icon: AMAZON_ICON,
  color: AMAZON_COLOR,
  credentials: amazonCredentials,
  metricTypes: amazonMetricTypes,
  fetcher: amazonFetcher,
  requiredPermissions: amazonPermissions,
  dateBucketing: "utc",
};

registerIntegration(amazonIntegration);

export default amazonIntegration;

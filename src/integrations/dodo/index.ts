import { registerIntegration } from "../registry";
import type { IntegrationDefinition } from "../types";
import {
    DODO_ID,
    DODO_NAME,
    DODO_DESCRIPTION,
    DODO_ICON,
    DODO_COLOR,
    dodoCredentials,
    dodoMetricTypes,
    dodoPermissions,
} from "./config";
import { dodoFetcher } from "./fetcher";

const dodoIntegration: IntegrationDefinition = {
    id: DODO_ID,
    name: DODO_NAME,
    description: DODO_DESCRIPTION,
    icon: DODO_ICON,
    color: DODO_COLOR,
    credentials: dodoCredentials,
    metricTypes: dodoMetricTypes,
    fetcher: dodoFetcher,
    requiredPermissions: dodoPermissions,
};

registerIntegration(dodoIntegration);

export default dodoIntegration;

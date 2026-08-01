import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { Campaign, CampaignDetail, CampaignInput, CampaignStats, ConnectionStatus, Contact, ContactUpdate, ExportData, HealthStatus, MessageVariantInput, MessageVariantResult, RemoteSessionHealthResult, SendCampaignBody, SendResult } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListCampaignsUrl: () => string;
/**
 * @summary List all campaigns
 */
export declare const listCampaigns: (options?: RequestInit) => Promise<Campaign[]>;
export declare const getListCampaignsQueryKey: () => readonly ["/api/campaigns"];
export declare const getListCampaignsQueryOptions: <TData = Awaited<ReturnType<typeof listCampaigns>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCampaigns>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCampaigns>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListCampaignsQueryResult = NonNullable<Awaited<ReturnType<typeof listCampaigns>>>;
export type ListCampaignsQueryError = ErrorType<unknown>;
/**
 * @summary List all campaigns
 */
export declare function useListCampaigns<TData = Awaited<ReturnType<typeof listCampaigns>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCampaigns>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateCampaignUrl: () => string;
/**
 * @summary Create a new campaign with contacts from uploaded data
 */
export declare const createCampaign: (campaignInput: CampaignInput, options?: RequestInit) => Promise<Campaign>;
export declare const getCreateCampaignMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCampaign>>, TError, {
        data: BodyType<CampaignInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCampaign>>, TError, {
    data: BodyType<CampaignInput>;
}, TContext>;
export type CreateCampaignMutationResult = NonNullable<Awaited<ReturnType<typeof createCampaign>>>;
export type CreateCampaignMutationBody = BodyType<CampaignInput>;
export type CreateCampaignMutationError = ErrorType<unknown>;
/**
* @summary Create a new campaign with contacts from uploaded data
*/
export declare const useCreateCampaign: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCampaign>>, TError, {
        data: BodyType<CampaignInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createCampaign>>, TError, {
    data: BodyType<CampaignInput>;
}, TContext>;
export declare const getGetCampaignUrl: (id: number) => string;
/**
 * @summary Get campaign with contacts
 */
export declare const getCampaign: (id: number, options?: RequestInit) => Promise<CampaignDetail>;
export declare const getGetCampaignQueryKey: (id: number) => readonly [`/api/campaigns/${number}`];
export declare const getGetCampaignQueryOptions: <TData = Awaited<ReturnType<typeof getCampaign>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCampaign>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCampaign>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCampaignQueryResult = NonNullable<Awaited<ReturnType<typeof getCampaign>>>;
export type GetCampaignQueryError = ErrorType<void>;
/**
 * @summary Get campaign with contacts
 */
export declare function useGetCampaign<TData = Awaited<ReturnType<typeof getCampaign>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCampaign>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getDeleteCampaignUrl: (id: number) => string;
/**
 * @summary Delete a campaign
 */
export declare const deleteCampaign: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteCampaignMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCampaign>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteCampaign>>, TError, {
    id: number;
}, TContext>;
export type DeleteCampaignMutationResult = NonNullable<Awaited<ReturnType<typeof deleteCampaign>>>;
export type DeleteCampaignMutationError = ErrorType<unknown>;
/**
* @summary Delete a campaign
*/
export declare const useDeleteCampaign: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCampaign>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteCampaign>>, TError, {
    id: number;
}, TContext>;
export declare const getSendCampaignUrl: (id: number) => string;
/**
 * @summary Start sending WhatsApp messages to all contacts in campaign
 */
export declare const sendCampaign: (id: number, sendCampaignBody: SendCampaignBody, options?: RequestInit) => Promise<SendResult>;
export declare const getSendCampaignMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof sendCampaign>>, TError, {
        id: number;
        data: BodyType<SendCampaignBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof sendCampaign>>, TError, {
    id: number;
    data: BodyType<SendCampaignBody>;
}, TContext>;
export type SendCampaignMutationResult = NonNullable<Awaited<ReturnType<typeof sendCampaign>>>;
export type SendCampaignMutationBody = BodyType<SendCampaignBody>;
export type SendCampaignMutationError = ErrorType<unknown>;
/**
* @summary Start sending WhatsApp messages to all contacts in campaign
*/
export declare const useSendCampaign: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof sendCampaign>>, TError, {
        id: number;
        data: BodyType<SendCampaignBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof sendCampaign>>, TError, {
    id: number;
    data: BodyType<SendCampaignBody>;
}, TContext>;
export declare const getExportCampaignUrl: (id: number) => string;
/**
 * @summary Export campaign results as JSON (for Excel download)
 */
export declare const exportCampaign: (id: number, options?: RequestInit) => Promise<ExportData>;
export declare const getExportCampaignQueryKey: (id: number) => readonly [`/api/campaigns/${number}/export`];
export declare const getExportCampaignQueryOptions: <TData = Awaited<ReturnType<typeof exportCampaign>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof exportCampaign>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof exportCampaign>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ExportCampaignQueryResult = NonNullable<Awaited<ReturnType<typeof exportCampaign>>>;
export type ExportCampaignQueryError = ErrorType<unknown>;
/**
 * @summary Export campaign results as JSON (for Excel download)
 */
export declare function useExportCampaign<TData = Awaited<ReturnType<typeof exportCampaign>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof exportCampaign>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetCampaignStatsUrl: (id: number) => string;
/**
 * @summary Get campaign statistics
 */
export declare const getCampaignStats: (id: number, options?: RequestInit) => Promise<CampaignStats>;
export declare const getGetCampaignStatsQueryKey: (id: number) => readonly [`/api/campaigns/${number}/stats`];
export declare const getGetCampaignStatsQueryOptions: <TData = Awaited<ReturnType<typeof getCampaignStats>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCampaignStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCampaignStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCampaignStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getCampaignStats>>>;
export type GetCampaignStatsQueryError = ErrorType<unknown>;
/**
 * @summary Get campaign statistics
 */
export declare function useGetCampaignStats<TData = Awaited<ReturnType<typeof getCampaignStats>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCampaignStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateContactUrl: (id: number) => string;
/**
 * @summary Update contact status (mark as will_sell/will_buy/not_interested)
 */
export declare const updateContact: (id: number, contactUpdate: ContactUpdate, options?: RequestInit) => Promise<Contact>;
export declare const getUpdateContactMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateContact>>, TError, {
        id: number;
        data: BodyType<ContactUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateContact>>, TError, {
    id: number;
    data: BodyType<ContactUpdate>;
}, TContext>;
export type UpdateContactMutationResult = NonNullable<Awaited<ReturnType<typeof updateContact>>>;
export type UpdateContactMutationBody = BodyType<ContactUpdate>;
export type UpdateContactMutationError = ErrorType<unknown>;
/**
* @summary Update contact status (mark as will_sell/will_buy/not_interested)
*/
export declare const useUpdateContact: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateContact>>, TError, {
        id: number;
        data: BodyType<ContactUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateContact>>, TError, {
    id: number;
    data: BodyType<ContactUpdate>;
}, TContext>;
export declare const getCheckWhatsappConnectionUrl: () => string;
/**
 * @summary Check if WhatsApp Green API is connected
 */
export declare const checkWhatsappConnection: (options?: RequestInit) => Promise<ConnectionStatus>;
export declare const getCheckWhatsappConnectionQueryKey: () => readonly ["/api/whatsapp/check-connection"];
export declare const getCheckWhatsappConnectionQueryOptions: <TData = Awaited<ReturnType<typeof checkWhatsappConnection>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof checkWhatsappConnection>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof checkWhatsappConnection>>, TError, TData> & {
    queryKey: QueryKey;
};
export type CheckWhatsappConnectionQueryResult = NonNullable<Awaited<ReturnType<typeof checkWhatsappConnection>>>;
export type CheckWhatsappConnectionQueryError = ErrorType<unknown>;
/**
 * @summary Check if WhatsApp Green API is connected
 */
export declare function useCheckWhatsappConnection<TData = Awaited<ReturnType<typeof checkWhatsappConnection>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof checkWhatsappConnection>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetRemoteWhatsappSessionsUrl: () => string;
/**
 * @summary Read measured session and ban telemetry from the remote WhatsApp server
 */
export declare const getRemoteWhatsappSessions: (options?: RequestInit) => Promise<RemoteSessionHealthResult>;
export declare const getGetRemoteWhatsappSessionsQueryKey: () => readonly ["/api/whatsapp/remote-sessions"];
export declare const getGetRemoteWhatsappSessionsQueryOptions: <TData = Awaited<ReturnType<typeof getRemoteWhatsappSessions>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRemoteWhatsappSessions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getRemoteWhatsappSessions>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetRemoteWhatsappSessionsQueryResult = NonNullable<Awaited<ReturnType<typeof getRemoteWhatsappSessions>>>;
export type GetRemoteWhatsappSessionsQueryError = ErrorType<void>;
/**
 * @summary Read measured session and ban telemetry from the remote WhatsApp server
 */
export declare function useGetRemoteWhatsappSessions<TData = Awaited<ReturnType<typeof getRemoteWhatsappSessions>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRemoteWhatsappSessions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGenerateMessageVariantsUrl: () => string;
/**
 * @summary Generate reusable WhatsApp message templates
 */
export declare const generateMessageVariants: (messageVariantInput: MessageVariantInput, options?: RequestInit) => Promise<MessageVariantResult>;
export declare const getGenerateMessageVariantsMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateMessageVariants>>, TError, {
        data: BodyType<MessageVariantInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateMessageVariants>>, TError, {
    data: BodyType<MessageVariantInput>;
}, TContext>;
export type GenerateMessageVariantsMutationResult = NonNullable<Awaited<ReturnType<typeof generateMessageVariants>>>;
export type GenerateMessageVariantsMutationBody = BodyType<MessageVariantInput>;
export type GenerateMessageVariantsMutationError = ErrorType<void>;
/**
* @summary Generate reusable WhatsApp message templates
*/
export declare const useGenerateMessageVariants: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateMessageVariants>>, TError, {
        data: BodyType<MessageVariantInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateMessageVariants>>, TError, {
    data: BodyType<MessageVariantInput>;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map
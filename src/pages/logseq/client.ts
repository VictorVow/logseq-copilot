import { getLogseqCopliotConfig } from '../../config';

export type LogseqPageResponse = {
  name: string;
  uuid: string;
  'journal?': boolean;
};

export type LogseqResponseType<T> = {
  status: number;
  msg: string;
  response: T;
  count?: number;
};

/**
 * Build the Logseq HTTP API URL from the stored hostname + port.
 *
 * Normalizes `localhost` to `127.0.0.1` because Firefox's extension fetch
 * resolves `localhost` to `::1` (IPv6) first, but Logseq's built-in HTTP
 * server only listens on `127.0.0.1` (IPv4). Letting users keep "localhost"
 * in the options page while silently dodging the IPv6 fallback.
 *
 * Also reconstructs the URL from the modern `logseqHostName` + `logseqPort`
 * pair rather than reading the legacy `logseqHost` URL string, which is no
 * longer written by the options page after the host/port split migration.
 */
const buildApiUrl = (hostName: string, port: number): URL => {
  const trimmed = (hostName || 'localhost').trim();
  const normalized = trimmed === 'localhost' ? '127.0.0.1' : trimmed;
  // Wrap raw IPv6 literals in brackets so `new URL()` parses them correctly.
  const hostForUrl =
    normalized.includes(':') && !normalized.startsWith('[')
      ? `[${normalized}]`
      : normalized;
  return new URL(`http://${hostForUrl}:${port || 12315}/api`);
};

export default class LogseqClientBase {
  baseFetch = async (method: string, args: any[]) => {
    const config = await getLogseqCopliotConfig();
    const apiUrl = buildApiUrl(config.logseqHostName, config.logseqPort);
    const resp = await fetch(apiUrl, {
      mode: 'cors',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.logseqAuthToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        method: method,
        args: args,
      }),
    });

    if (resp.status !== 200) {
      throw resp;
    }

    return resp;
  };

  baseJson = async (method: string, args: any[]) => {
    const resp = await this.baseFetch(method, args);
    const data = await resp.json();
    // Suppress logging for the hot-path DB-graph detection check —
    // getLogseqService() fires it on every request, flooding the
    // console.
    if (method !== 'logseq.App.checkCurrentIsDbGraph') {
      console.debug(`Logseq Method ${method}, Response -> \n`, data);
    }
    return data;
  };

  public isDBGraph = async () => {
    // Logseq's HTTP API exposes this as `logseq.App.checkCurrentIsDbGraph`
    // (camelCase, under the `App` namespace). The snake_case alias
    // `check_current_is_db_graph` was never real — calling it returns
    // `{"error":"MethodNotExist: ..."}` with HTTP 500.
    return await this.baseJson('logseq.App.checkCurrentIsDbGraph', []);
  };
}

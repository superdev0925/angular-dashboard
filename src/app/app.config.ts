import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { InMemoryCache } from '@apollo/client/core';
import { APOLLO_NAMED_OPTIONS, ApolloModule, NamedOptions } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from './app.routes';

const POKEAPI_URL_DIRECT = 'https://beta.pokeapi.co/graphql/v1beta';
const POKEAPI_URL_PROXY = '/pokeapi-graphql';
const LOCAL_GRAPHQL_URL = 'http://localhost:4000/';

/** Use dev-server proxy during `ng serve` to avoid PokéAPI CORS blocks. */
function resolvePokeApiGraphqlUri(): string {
  if (typeof window === 'undefined') {
    return POKEAPI_URL_DIRECT;
  }
  const { hostname, port } = window.location;
  const devPorts = new Set(['4200', '4201', '4202']);
  if (devPorts.has(port)) {
    return POKEAPI_URL_PROXY;
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return POKEAPI_URL_PROXY;
  }
  return POKEAPI_URL_DIRECT;
}

/**
 * Configures dual Apollo clients: default for PokéAPI, `local` for json-graphql-server.
 */
export function apolloNamedOptions(httpLink: HttpLink): NamedOptions {
  return {
    default: {
      link: httpLink.create({ uri: resolvePokeApiGraphqlUri() }),
      cache: new InMemoryCache(),
      defaultOptions: {
        query: { fetchPolicy: 'no-cache', errorPolicy: 'all' },
      },
    },
    local: {
      link: httpLink.create({ uri: LOCAL_GRAPHQL_URL }),
      cache: new InMemoryCache(),
      defaultOptions: {
        query: { fetchPolicy: 'network-only', errorPolicy: 'all' },
      },
    },
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(),
    provideAnimations(),
    importProvidersFrom(ApolloModule),
    {
      provide: APOLLO_NAMED_OPTIONS,
      useFactory: apolloNamedOptions,
      deps: [HttpLink],
    },
  ],
};

import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { InMemoryCache } from '@apollo/client/core';
import { APOLLO_NAMED_OPTIONS, ApolloModule, NamedOptions } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from './app.routes';

const POKEAPI_URL = 'https://beta.pokeapi.co/graphql/v1beta';
const LOCAL_GRAPHQL_URL = 'http://localhost:4000/';

/**
 * Configures dual Apollo clients: default for PokéAPI, `local` for json-graphql-server.
 */
export function apolloNamedOptions(httpLink: HttpLink): NamedOptions {
  return {
    default: {
      link: httpLink.create({ uri: POKEAPI_URL }),
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

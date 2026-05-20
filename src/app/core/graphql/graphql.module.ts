import { NgModule } from '@angular/core';
import { ApolloClientOptions, InMemoryCache } from '@apollo/client/core';
import { APOLLO_OPTIONS } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';

const POKEAPI_URL = 'https://beta.pokeapi.co/graphql/v1beta';
const LOCAL_API_URL = 'http://localhost:4000/graphql';

export function createApollo(httpLink: HttpLink): ApolloClientOptions<any> {
  return {
    link: httpLink.create({ uri: POKEAPI_URL }),
    cache: new InMemoryCache(),
  };
}

export function createLocalApollo(httpLink: HttpLink): ApolloClientOptions<any> {
  return {
    link: httpLink.create({ uri: LOCAL_API_URL }),
    cache: new InMemoryCache(),
  };
}

@NgModule({
  providers: [
    {
      provide: APOLLO_OPTIONS,
      useFactory: createApollo,
      deps: [HttpLink],
    },
  ],
})
export class GraphQLModule {}

@NgModule({
  providers: [
    {
      provide: 'LOCAL_APOLLO',
      useFactory: createLocalApollo,
      deps: [HttpLink],
    },
  ],
})
export class LocalGraphQLModule {}


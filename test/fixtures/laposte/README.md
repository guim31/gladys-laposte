# La Poste API fixtures

Answers of the La Poste "Suivi" API v2 (`GET https://api.laposte.fr/suivi/v2/idships/{id}`),
served by the simulated API of `test/helpers/world.js`. No test touches the network.

| File                                                                                                                                                | Origin                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `in-transit.json`, `error-400.json`, `error-401-api.json`, `error-404.json`, `error-429.json`, `error-500.json`, `error-503.json`, `error-504.json` | Mock answers of [debuss/LaPosteSuivi](https://github.com/debuss/LaPosteSuivi) (`tests/Mock`, MIT licence, © 2020 debuss-a), built on the API documentation. The tracking number of `in-transit.json` is replaced by an invented one.             |
| `error-401-okapi.json`                                                                                                                              | Real answer of `api.laposte.fr` to a request without a valid key (14/10/2026): the Okapi gateway's own body shape.                                                                                                                               |
| `out-for-delivery.json`, `awaiting-pickup.json`, `delivered.json`, `problem.json`, `chronopost-delivered.json`                                      | Derived from `in-transit.json` with the event codes of the API documentation (MD2, AG1, DI1, PB1), as listed by [e-amzallag/laposte-suivi-api](https://github.com/e-amzallag/laposte-suivi-api) (Apache 2.0). Invented numbers and pickup point. |

None of them was captured with an API key: the integration was developed without one.

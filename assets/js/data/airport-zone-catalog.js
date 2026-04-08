(function () {
  "use strict";

  window.PIXKUY_AIRPORT_ZONE_CATALOG = {
    airports: [
      {
        id: "mex",
        iata: "MEX",
        labelKey: "services.cards.airport.panel.catalog.airports.mex",
        active: true
      },
      {
        id: "nlu",
        iata: "NLU",
        labelKey: "services.cards.airport.panel.catalog.airports.nlu",
        active: true
      },
      {
        id: "tlc",
        iata: "TLC",
        labelKey: "services.cards.airport.panel.catalog.airports.tlc",
        active: true
      },
      {
        id: "pbc",
        iata: "PBC",
        labelKey: "services.cards.airport.panel.catalog.airports.pbc",
        active: true
      },
      {
        id: "qro",
        iata: "QRO",
        labelKey: "services.cards.airport.panel.catalog.airports.qro",
        active: true
      }
    ],
    zones: [
      {
        id: "centro",
        labelKey: "services.cards.airport.panel.catalog.zones.centro",
        active: true
      },
      {
        id: "reforma",
        labelKey: "services.cards.airport.panel.catalog.zones.reforma",
        active: true
      },
      {
        id: "polanco",
        labelKey: "services.cards.airport.panel.catalog.zones.polanco",
        active: true
      },
      {
        id: "roma_condesa",
        labelKey: "services.cards.airport.panel.catalog.zones.roma_condesa",
        active: true
      },
      {
        id: "santa_fe",
        labelKey: "services.cards.airport.panel.catalog.zones.santa_fe",
        active: true
      },
      {
        id: "coyoacan_del_valle_napoles",
        labelKey: "services.cards.airport.panel.catalog.zones.coyoacan_del_valle_napoles",
        active: true
      },
      {
        id: "sur",
        labelKey: "services.cards.airport.panel.catalog.zones.sur",
        active: true
      },
      {
        id: "norte",
        labelKey: "services.cards.airport.panel.catalog.zones.norte",
        active: true
      },
      {
        id: "aeropuerto_oriente",
        labelKey: "services.cards.airport.panel.catalog.zones.aeropuerto_oriente",
        active: true
      }
    ],
    fares: [
      { airportId: "mex", zoneId: "aeropuerto_oriente", fareKey: "van_1_2", price: 700, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "aeropuerto_oriente", fareKey: "van_3_4", price: 950, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "aeropuerto_oriente", fareKey: "van_5_6", price: 1200, currency: "MXN", active: true },

      { airportId: "mex", zoneId: "centro", fareKey: "van_1_2", price: 725, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "centro", fareKey: "van_3_4", price: 975, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "centro", fareKey: "van_5_6", price: 1225, currency: "MXN", active: true },

      { airportId: "mex", zoneId: "reforma", fareKey: "van_1_2", price: 775, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "reforma", fareKey: "van_3_4", price: 1025, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "reforma", fareKey: "van_5_6", price: 1275, currency: "MXN", active: true },

      { airportId: "mex", zoneId: "roma_condesa", fareKey: "van_1_2", price: 800, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "roma_condesa", fareKey: "van_3_4", price: 1050, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "roma_condesa", fareKey: "van_5_6", price: 1300, currency: "MXN", active: true },

      { airportId: "mex", zoneId: "polanco", fareKey: "van_1_2", price: 875, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "polanco", fareKey: "van_3_4", price: 1125, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "polanco", fareKey: "van_5_6", price: 1375, currency: "MXN", active: true },

      { airportId: "mex", zoneId: "norte", fareKey: "van_1_2", price: 850, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "norte", fareKey: "van_3_4", price: 1100, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "norte", fareKey: "van_5_6", price: 1350, currency: "MXN", active: true },

      { airportId: "mex", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_1_2", price: 925, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_3_4", price: 1175, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_5_6", price: 1425, currency: "MXN", active: true },

      { airportId: "mex", zoneId: "sur", fareKey: "van_1_2", price: 1025, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "sur", fareKey: "van_3_4", price: 1275, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "sur", fareKey: "van_5_6", price: 1525, currency: "MXN", active: true },

      { airportId: "mex", zoneId: "santa_fe", fareKey: "van_1_2", price: 1200, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "santa_fe", fareKey: "van_3_4", price: 1450, currency: "MXN", active: true },
      { airportId: "mex", zoneId: "santa_fe", fareKey: "van_5_6", price: 1700, currency: "MXN", active: true },

      { airportId: "nlu", zoneId: "aeropuerto_oriente", fareKey: "van_1_2", price: 1100, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "aeropuerto_oriente", fareKey: "van_3_4", price: 1450, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "aeropuerto_oriente", fareKey: "van_5_6", price: 1825, currency: "MXN", active: true },

      { airportId: "nlu", zoneId: "centro", fareKey: "van_1_2", price: 1175, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "centro", fareKey: "van_3_4", price: 1525, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "centro", fareKey: "van_5_6", price: 1900, currency: "MXN", active: true },

      { airportId: "nlu", zoneId: "reforma", fareKey: "van_1_2", price: 1250, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "reforma", fareKey: "van_3_4", price: 1600, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "reforma", fareKey: "van_5_6", price: 1975, currency: "MXN", active: true },

      { airportId: "nlu", zoneId: "roma_condesa", fareKey: "van_1_2", price: 1275, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "roma_condesa", fareKey: "van_3_4", price: 1625, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "roma_condesa", fareKey: "van_5_6", price: 2000, currency: "MXN", active: true },

      { airportId: "nlu", zoneId: "polanco", fareKey: "van_1_2", price: 1350, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "polanco", fareKey: "van_3_4", price: 1700, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "polanco", fareKey: "van_5_6", price: 2075, currency: "MXN", active: true },

      { airportId: "nlu", zoneId: "norte", fareKey: "van_1_2", price: 1025, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "norte", fareKey: "van_3_4", price: 1375, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "norte", fareKey: "van_5_6", price: 1750, currency: "MXN", active: true },

      { airportId: "nlu", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_1_2", price: 1450, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_3_4", price: 1800, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_5_6", price: 2175, currency: "MXN", active: true },

      { airportId: "nlu", zoneId: "sur", fareKey: "van_1_2", price: 1550, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "sur", fareKey: "van_3_4", price: 1900, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "sur", fareKey: "van_5_6", price: 2275, currency: "MXN", active: true },

      { airportId: "nlu", zoneId: "santa_fe", fareKey: "van_1_2", price: 1675, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "santa_fe", fareKey: "van_3_4", price: 2025, currency: "MXN", active: true },
      { airportId: "nlu", zoneId: "santa_fe", fareKey: "van_5_6", price: 2400, currency: "MXN", active: true },

      { airportId: "tlc", zoneId: "aeropuerto_oriente", fareKey: "van_1_2", price: 1725, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "aeropuerto_oriente", fareKey: "van_3_4", price: 2075, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "aeropuerto_oriente", fareKey: "van_5_6", price: 2475, currency: "MXN", active: true },

      { airportId: "tlc", zoneId: "centro", fareKey: "van_1_2", price: 1525, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "centro", fareKey: "van_3_4", price: 1875, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "centro", fareKey: "van_5_6", price: 2275, currency: "MXN", active: true },

      { airportId: "tlc", zoneId: "reforma", fareKey: "van_1_2", price: 1425, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "reforma", fareKey: "van_3_4", price: 1775, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "reforma", fareKey: "van_5_6", price: 2175, currency: "MXN", active: true },

      { airportId: "tlc", zoneId: "roma_condesa", fareKey: "van_1_2", price: 1450, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "roma_condesa", fareKey: "van_3_4", price: 1800, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "roma_condesa", fareKey: "van_5_6", price: 2200, currency: "MXN", active: true },

      { airportId: "tlc", zoneId: "polanco", fareKey: "van_1_2", price: 1325, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "polanco", fareKey: "van_3_4", price: 1675, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "polanco", fareKey: "van_5_6", price: 2075, currency: "MXN", active: true },

      { airportId: "tlc", zoneId: "norte", fareKey: "van_1_2", price: 1675, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "norte", fareKey: "van_3_4", price: 2025, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "norte", fareKey: "van_5_6", price: 2425, currency: "MXN", active: true },

      { airportId: "tlc", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_1_2", price: 1500, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_3_4", price: 1850, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_5_6", price: 2250, currency: "MXN", active: true },

      { airportId: "tlc", zoneId: "sur", fareKey: "van_1_2", price: 1575, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "sur", fareKey: "van_3_4", price: 1925, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "sur", fareKey: "van_5_6", price: 2325, currency: "MXN", active: true },

      { airportId: "tlc", zoneId: "santa_fe", fareKey: "van_1_2", price: 1100, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "santa_fe", fareKey: "van_3_4", price: 1450, currency: "MXN", active: true },
      { airportId: "tlc", zoneId: "santa_fe", fareKey: "van_5_6", price: 1850, currency: "MXN", active: true },

      { airportId: "pbc", zoneId: "aeropuerto_oriente", fareKey: "van_1_2", price: 1725, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "aeropuerto_oriente", fareKey: "van_3_4", price: 2300, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "aeropuerto_oriente", fareKey: "van_5_6", price: 2950, currency: "MXN", active: true },

      { airportId: "pbc", zoneId: "centro", fareKey: "van_1_2", price: 1875, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "centro", fareKey: "van_3_4", price: 2450, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "centro", fareKey: "van_5_6", price: 3100, currency: "MXN", active: true },

      { airportId: "pbc", zoneId: "reforma", fareKey: "van_1_2", price: 1975, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "reforma", fareKey: "van_3_4", price: 2550, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "reforma", fareKey: "van_5_6", price: 3200, currency: "MXN", active: true },

      { airportId: "pbc", zoneId: "roma_condesa", fareKey: "van_1_2", price: 2000, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "roma_condesa", fareKey: "van_3_4", price: 2575, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "roma_condesa", fareKey: "van_5_6", price: 3225, currency: "MXN", active: true },

      { airportId: "pbc", zoneId: "polanco", fareKey: "van_1_2", price: 2675, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "polanco", fareKey: "van_3_4", price: 2825, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "polanco", fareKey: "van_5_6", price: 3325, currency: "MXN", active: true },

      { airportId: "pbc", zoneId: "norte", fareKey: "van_1_2", price: 2175, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "norte", fareKey: "van_3_4", price: 2750, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "norte", fareKey: "van_5_6", price: 3400, currency: "MXN", active: true },

      { airportId: "pbc", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_1_2", price: 2050, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_3_4", price: 2625, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_5_6", price: 3275, currency: "MXN", active: true },

      { airportId: "pbc", zoneId: "sur", fareKey: "van_1_2", price: 2125, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "sur", fareKey: "van_3_4", price: 2700, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "sur", fareKey: "van_5_6", price: 3350, currency: "MXN", active: true },

      { airportId: "pbc", zoneId: "santa_fe", fareKey: "van_1_2", price: 2275, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "santa_fe", fareKey: "van_3_4", price: 2850, currency: "MXN", active: true },
      { airportId: "pbc", zoneId: "santa_fe", fareKey: "van_5_6", price: 3500, currency: "MXN", active: true },

      { airportId: "qro", zoneId: "aeropuerto_oriente", fareKey: "van_1_2", price: 3200, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "aeropuerto_oriente", fareKey: "van_3_4", price: 4075, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "aeropuerto_oriente", fareKey: "van_5_6", price: 5075, currency: "MXN", active: true },

      { airportId: "qro", zoneId: "centro", fareKey: "van_1_2", price: 2650, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "centro", fareKey: "van_3_4", price: 3800, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "centro", fareKey: "van_5_6", price: 4800, currency: "MXN", active: true },

      { airportId: "qro", zoneId: "reforma", fareKey: "van_1_2", price: 2875, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "reforma", fareKey: "van_3_4", price: 3750, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "reforma", fareKey: "van_5_6", price: 4750, currency: "MXN", active: true },

      { airportId: "qro", zoneId: "roma_condesa", fareKey: "van_1_2", price: 2950, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "roma_condesa", fareKey: "van_3_4", price: 3825, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "roma_condesa", fareKey: "van_5_6", price: 4825, currency: "MXN", active: true },

      { airportId: "qro", zoneId: "polanco", fareKey: "van_1_2", price: 2800, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "polanco", fareKey: "van_3_4", price: 3675, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "polanco", fareKey: "van_5_6", price: 4675, currency: "MXN", active: true },

      { airportId: "qro", zoneId: "norte", fareKey: "van_1_2", price: 2650, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "norte", fareKey: "van_3_4", price: 3525, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "norte", fareKey: "van_5_6", price: 4525, currency: "MXN", active: true },

      { airportId: "qro", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_1_2", price: 3125, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_3_4", price: 4000, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "coyoacan_del_valle_napoles", fareKey: "van_5_6", price: 5000, currency: "MXN", active: true },

      { airportId: "qro", zoneId: "sur", fareKey: "van_1_2", price: 3300, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "sur", fareKey: "van_3_4", price: 4175, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "sur", fareKey: "van_5_6", price: 5175, currency: "MXN", active: true },

      { airportId: "qro", zoneId: "santa_fe", fareKey: "van_1_2", price: 3025, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "santa_fe", fareKey: "van_3_4", price: 3900, currency: "MXN", active: true },
      { airportId: "qro", zoneId: "santa_fe", fareKey: "van_5_6", price: 4900, currency: "MXN", active: true }
    ]
  };
})();
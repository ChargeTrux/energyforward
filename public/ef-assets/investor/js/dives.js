/* energyforward · dive content
   keys are organized by section.
   journey dives carry: kicker, title, destination key, scenes[3], context, body (closing receipt)
   text dives carry:    kicker, title, body (html)
   the renderer in app.js detects { journey: true } and lays out a multi-scene panel.
*/
(function(){
  'use strict';

  // ─── destination registry ─────────────────────────────────────
  // each destination supplies the arrival image + arrival language + a receipt
  const DEST = {
    rideshare: {
      tag: '03 · arrival',
      img: 'img/ef-dest-rideshare.png',
      label: 'autonomous & ride-share depot',
      claim: 'electrons arrive where the wheels are already turning.',
      sub: 'energytrux docks at the depot. dc fast charging runs while the next rotation of vehicles queues. no interconnect. no demand-charge surprise.',
      receipt: [
        {n:'4.0', u:'mwh', l:'delivered per trip'},
        {n:'180', u:'kw', l:'dc fast per stall'},
        {n:'24/7', u:'', l:'uptime, by contract'}
      ]
    },
    drayage: {
      tag: '03 · arrival',
      img: 'img/ef-dest-drayage.png',
      label: 'port · drayage yard',
      claim: 'power lands inside the terminal gate, not on a waitlist.',
      sub: 'energytrux pulls into the yard. tractors charge between turns. the port meets its zero-emission deadline without waiting on a substation upgrade.',
      receipt: [
        {n:'4.0', u:'mwh', l:'per trailer'},
        {n:'250', u:'kw', l:'per drayage stall'},
        {n:'0', u:'', l:'utility delay'}
      ]
    },
    warehouse: {
      tag: '03 · arrival',
      img: 'img/ef-dest-warehouse.png',
      label: 'flagship off-grid building',
      claim: 'the building runs on power that was scheduled, not requested.',
      sub: 'a chargehub holds capacity on-site. energytrux refills it on cycle. the tenant occupies a building the grid said wouldn\'t be ready until 2028.',
      receipt: [
        {n:'24', u:'mwh', l:'on-site reserve'},
        {n:'72', u:'hr', l:'autonomy'},
        {n:'100%', u:'', l:'solar-charged'}
      ]
    },
    datacenter: {
      tag: '03 · arrival',
      img: 'img/ef-dest-datacenter.png',
      label: 'hyperscaler · bridge load',
      claim: 'the rack lights up while the substation is still being built.',
      sub: 'a demandhub at the campus accepts back-to-back energytrux deliveries. the operator gets revenue-bearing capacity now and decommissions to standby when permanent power arrives.',
      receipt: [
        {n:'40', u:'mwh', l:'per hub'},
        {n:'10', u:'mw', l:'continuous bridge'},
        {n:'24', u:'mo', l:'typical bridge term'}
      ]
    },
    chargehub: {
      tag: '03 · arrival',
      img: 'img/ef-dest-chargehub.png',
      label: 'chargehub · stationary site',
      claim: 'a charging site that doesn\'t need a transformer upgrade.',
      sub: 'the chargehub sits behind the meter or fully off-grid. energytrux replenishes the battery overnight. utilization stays high; demand charges stay low.',
      receipt: [
        {n:'4–24', u:'mwh', l:'site capacity'},
        {n:'8', u:'stalls', l:'typical buildout'},
        {n:'30%', u:'', l:'lower $/kwh delivered'}
      ]
    }
  };

  // ─── helpers ──────────────────────────────────────────────────
  function scene1(claim, sub){
    return {
      tag: '01 · load-out',
      img: 'img/ef-platform-schematic.png',
      claim: claim || 'an energyhub fills a 4 mwh container.',
      sub: sub || 'solar generation, behind-the-meter. battery state-of-charge climbs to 100%. an energytrux backs in and couples.'
    };
  }
  function scene2(claim, sub){
    return {
      tag: '02 · transit',
      img: 'img/ef-highway-pull.png',
      claim: claim || 'the container moves to where the load is.',
      sub: sub || 'highway transit, not interconnect queue. distance is a routing problem, not a permitting problem.'
    };
  }

  // ─── journey dive builder ─────────────────────────────────────
  function journey(opts){
    return {
      journey: true,
      kicker: opts.kicker,
      title: opts.title,
      dest: opts.dest,
      scenes: [
        scene1(opts.s1, opts.s1sub),
        scene2(opts.s2, opts.s2sub),
        // scene 3 is composed from DEST[opts.dest]
      ],
      context: opts.context,
      body: opts.body || ''
    };
  }

  // ─── content map ──────────────────────────────────────────────
  const D = {};

  // problem ─────────────────────────────────────────────────────
  D['problem-supply'] = {
    kicker: 'the bottleneck · supply',
    title: 'transformers and substations are the new permit.',
    body: `
      <p>large-power interconnect queues in cisr-iso and wecc territory now run <strong>4 to 7 years</strong>. transformer lead times for utility-scale gear sit at <strong>120+ weeks</strong>. distribution upgrades for ev fast-charging sites routinely push past <strong>$2m per site</strong>.</p>
      <p>the grid is not failing. it is fully booked. capacity exists on the generation side and on the demand side; the railroad between them is full.</p>
      <h3>what we read from this</h3>
      <ul>
        <li>any new load that depends on a new interconnect is competing with every other new load for the same scarce capacity.</li>
        <li>any solution that requires a utility upgrade inherits the utility's timeline.</li>
        <li>the unit of scarcity is not energy. it is <em>scheduled delivery of energy</em>.</li>
      </ul>
    `
  };
  D['problem-demand'] = {
    kicker: 'the bottleneck · demand',
    title: 'the loads showed up early.',
    body: `
      <p>data centers, electrified fleets, ports, and industrial reshoring all arrived inside a single 24-month window. each is a multi-megawatt load with its own deadline — ai capex cycles, zero-emission mandates, lease commitments. none of them can wait on a 2030 substation.</p>
      <p>these are not speculative loads. they are <strong>contracted, financed, and under construction</strong>. what they lack is the last mile of power.</p>
    `
  };
  D['problem-ceiling'] = {
    kicker: 'the bottleneck · ceiling',
    title: 'utilities cannot grow at the speed of capital.',
    body: `
      <p>investor-owned utilities operate under rate-case timelines, ferc approval, and regulated capex envelopes. their job is to build durable infrastructure, not to absorb commercial deadlines from private operators.</p>
      <p>this is not a criticism of the utility. it is an acknowledgment that the railroad and the highway are <strong>different industries</strong>, and the highway has not been built yet.</p>
    `
  };

  // thesis ──────────────────────────────────────────────────────
  D['thesis-railroad'] = {
    kicker: 'thesis · the railroad',
    title: 'the grid is the railroad.',
    body: `
      <p>fixed routes, regulated tariffs, multi-year buildouts, durable infrastructure. that is what the grid is, and that is what it should remain. it carries the bulk of electrons at the lowest unit cost in the world.</p>
      <p>but a railroad cannot serve a customer that is not on the line. and it cannot speed up to meet a contractual deadline that was set in a private boardroom.</p>
    `
  };
  D['thesis-highway'] = {
    kicker: 'thesis · the highway',
    title: 'then, the highway.',
    body: `
      <p>mobile, routable, contract-priced energy. battery containers move on flatbed trucks from generation to load. delivery is scheduled the way freight is scheduled, not the way utilities are scheduled.</p>
      <p>this is not a replacement for the grid. it is the <strong>complement</strong> the grid has always needed and never built — the off-ramp, the last mile, the temporary lane.</p>
    `
  };
  D['thesis-apply'] = {
    kicker: 'thesis · the consequence',
    title: 'speed to power, decoupled from the speed of grid construction.',
    body: `
      <p>once energy delivery is a freight problem, the timeline collapses from years to weeks. a data center can take load now and decommission to standby in 24 months. a port can hit its 2030 mandate in 2026. an off-grid building can occupy in q3 instead of 2028.</p>
      <p>the rest of this deck is the operational and financial expression of that single sentence.</p>
    `
  };

  // platform entities ───────────────────────────────────────────
  D['energyhubs'] = {
    kicker: 'the platform · supply',
    title: 'energyhubs — where electrons enter the highway.',
    body: `
      <p>an energyhub is a co-located generation + storage site, typically <strong>50 mw solar + 200 mwh battery</strong>, built on land we control or lease at curtailment-priced economics. it is grid-tied where possible and grid-independent where preferable.</p>
      <p>the hub's job is not to sell power to the grid. it is to <strong>load energytrux containers</strong> on a schedule that matches contracted deliveries downstream.</p>
      <h3>why this works</h3>
      <ul>
        <li>solar is now the cheapest unit of new generation in our service territory.</li>
        <li>curtailment is structurally rising — the hub captures electrons that would otherwise be discarded.</li>
        <li>the asset earns under itc + production economics whether or not it ever exports to the grid.</li>
      </ul>
    `
  };
  D['energytrux'] = journey({
    kicker: 'the platform · transport',
    title: 'energytrux — the highway vehicle.',
    dest: 'rideshare',
    s1: 'an energyhub fills a 4 mwh container in a single solar cycle.',
    s1sub: 'we use a standard intermodal flatbed and a class-8 tractor. the container is a 9540a-tested lfp pack with onboard bms and dot-compliant transport rating.',
    s2: 'a single energytrux is a moving 4 mwh of contracted capacity.',
    s2sub: 'no interconnect. no utility approval. distance is a routing problem.',
    context: `
      <h3>operational economics</h3>
      <p>each energytrux completes <strong>~1.0 round trips per day</strong> at a 220-mile average haul. fleet utilization at scale targets <strong>92% revenue-hour availability</strong>, modeled on drayage and ltl freight benchmarks rather than utility availability metrics.</p>
      <p>capex per energytrux including container + tractor + chassis is in line with a heavy-spec class-8 sleeper plus a 4 mwh lfp pack at current cell pricing. that asset earns under a contracted $/kwh-delivered tariff with itc-bearing battery economics.</p>
    `
  });
  D['energyports'] = {
    kicker: 'the platform · interchange',
    title: 'energyports — where the highway changes lanes.',
    body: `
      <p>an energyport is a staging and switching node: a yard with simultaneous container charging, chassis swap, and dispatch routing. think intermodal rail yard, sized for 4 mwh containers instead of 53-foot dry vans.</p>
      <p>energyports compress the delivery cycle. a fully loaded container can be swapped onto an outbound tractor in under <strong>20 minutes</strong>, the same way a port crane swaps a marine container.</p>
    `
  };
  D['chargetrux'] = journey({
    kicker: 'the platform · charging vehicle',
    title: 'chargetrux — fast charging that drives to you.',
    dest: 'rideshare',
    s1: 'a chargetrux is an energytrux configured with dc fast-charge dispensers.',
    s1sub: 'four to eight stalls per unit, 180–350 kw per stall, drawing from the onboard 4 mwh pack rather than from utility service.',
    s2: 'it deploys to where vehicles already are — depots, lots, event sites.',
    s2sub: 'no permit. no transformer. no demand charge. the vehicle is the charging infrastructure.',
    context: `
      <h3>why this matters</h3>
      <p>the fastest path to ev fleet adoption is not building more permanent stations. it is making charging a service that can be scheduled and relocated the way a generator rental is today — but with zero-emission delivery and contracted $/kwh pricing.</p>
    `
  });
  D['chargehubs'] = journey({
    kicker: 'the platform · stationary charging',
    title: 'chargehubs — a charging site without a transformer upgrade.',
    dest: 'chargehub',
    s1: 'a chargehub is a permanent installation: 4–24 mwh of battery + dc fast stalls.',
    s1sub: 'it sits behind the meter or fully off-grid. utility service, if any, is sized for trickle replenishment, not peak draw.',
    s2: 'energytrux replenishes the chargehub on a freight schedule.',
    s2sub: 'the site never waits on a utility upgrade and never pays a demand charge for peak draw.',
    context: `
      <h3>economics</h3>
      <p>compared to a conventional dc fast site, a chargehub eliminates the largest cost line items: the transformer, the service upgrade, and the demand-charge tail. delivered $/kwh is typically <strong>25–30% lower</strong> on equivalent utilization.</p>
    `
  });
  D['demandhubs'] = journey({
    kicker: 'the platform · load-side',
    title: 'demandhubs — a building or campus receiving scheduled deliveries.',
    dest: 'datacenter',
    s1: 'a demandhub is the receiving end at a customer site.',
    s1sub: 'switchgear, container coupling pads, monitoring. sized to the load — 10 mw, 25 mw, 50 mw — and built in weeks, not years.',
    s2: 'energytrux deliveries are scheduled the same way diesel deliveries are scheduled today.',
    s2sub: 'except the energy is solar, the delivery is silent, and the timeline is set by contract rather than by ferc.',
    context: `
      <h3>the bridge use case</h3>
      <p>a demandhub lets a hyperscaler take revenue-bearing load <strong>24+ months</strong> before permanent grid power arrives, and then transition to standby/backup duty once the substation comes online. the asset never becomes stranded.</p>
    `
  });

  // operations ──────────────────────────────────────────────────
  D['op-generate'] = {
    kicker: 'how it works · 01',
    title: 'generate — solar fills the container.',
    body: `
      <p>at the energyhub, a 50 mw solar field charges a 200 mwh stationary buffer. from that buffer, individual 4 mwh energytrux containers top off and prepare for dispatch. the hub never sells to the grid unless prices warrant it; the default disposition is <strong>fill a container and dispatch it</strong>.</p>
    `
  };
  D['op-transport'] = journey({
    kicker: 'how it works · 02',
    title: 'transport — the container moves to the load.',
    dest: 'rideshare',
    s1: 'the container is coupled to a class-8 tractor.',
    s1sub: 'standard intermodal hardware. no special permits beyond hazmat-9 battery transport.',
    s2: 'the haul is dispatched on a freight schedule.',
    s2sub: 'route optimization, return logistics, and chain-of-custody mirror dry-van freight, with $/kwh-delivered settled at arrival.',
    context: `
      <h3>at scale</h3>
      <p>average haul distance is modeled at <strong>220 miles</strong> with a <strong>92% revenue-hour availability</strong> target. routing is co-optimized across hubs, customers, and return loops; an empty container is itself a routable asset.</p>
    `
  });
  D['op-meet'] = {
    kicker: 'how it works · 03',
    title: 'meet — the container couples to a demandhub.',
    body: `
      <p>at the customer site, the loaded energytrux backs into a coupling pad. switchgear is pre-permitted; the connection is metered, monitored, and remotely commissioned. dispatch time from gate to live load is under <strong>15 minutes</strong>.</p>
    `
  };
  D['op-deliver'] = journey({
    kicker: 'how it works · 04',
    title: 'deliver — the load receives contracted energy.',
    dest: 'rideshare',
    s1: 'the container discharges into the customer\'s load.',
    s1sub: '4 mwh delivered at the contracted profile — base, peak, or programmable. metering is bidirectional and audited.',
    s2: 'a fresh container can rotate in before the first one is empty.',
    s2sub: 'continuous service is achieved by overlapping arrivals, not by a single oversized asset.',
    context: `
      <h3>the customer sees</h3>
      <p>a meter, a monthly invoice, and a kwh count. they do not see the dispatch optimization, the route, or the hub. the highway is invisible to the customer — exactly the way a railroad should be.</p>
    `
  });
  D['op-return'] = {
    kicker: 'how it works · 05',
    title: 'return — the container goes home.',
    body: `
      <p>the empty container returns to the nearest energyhub or energyport for recharge. return logistics are co-optimized with outbound dispatch so deadhead miles are minimized. each container completes roughly one full round trip per day at scale.</p>
    `
  };

  // market ──────────────────────────────────────────────────────
  D['mkt-datacenter'] = journey({
    kicker: 'market · 01',
    title: 'data centers — the bridge load.',
    dest: 'datacenter',
    s1: 'a 50 mw campus signs for permanent grid power that arrives in 2028.',
    s1sub: 'it cannot wait. ai capex cycles are 18 months. lease commitments and tenant slas are already signed.',
    s2: 'we deliver scheduled mwh into a demandhub at the site.',
    s2sub: 'the campus takes revenue-bearing load now and transitions to standby/backup when the substation arrives.',
    context: `
      <h3>tam framing</h3>
      <p>permanent power is not the addressable market — <strong>bridge power</strong> is. every multi-year interconnect queue is a contract opportunity priced at deadline urgency rather than commodity spot.</p>
    `
  });
  D['mkt-fleets'] = journey({
    kicker: 'market · 02',
    title: 'autonomous & ride-share fleets.',
    dest: 'rideshare',
    s1: 'a depot in the inland empire needs 6 mw of fast charging by q4.',
    s1sub: 'the utility upgrade is quoted at $2.8m and 22 months. the operator does not have either.',
    s2: 'we deliver power via energytrux + chargehub.',
    s2sub: 'the depot is live in 90 days at a contracted $/kwh that pencils against the operator\'s vehicle revenue per mile.',
    context: `
      <h3>partners under conversation</h3>
      <p>discussions are active with avis, uber, and aaa-affiliated fleet operators on pilots structured as bridge contracts that convert to multi-year offtake once utilization is proven.</p>
    `
  });
  D['mkt-ports'] = journey({
    kicker: 'market · 03',
    title: 'ports & drayage — the zero-emission deadline.',
    dest: 'drayage',
    s1: 'california\'s drayage truck deadline is 2035. the port of long beach has 18,000 drayage tractors.',
    s1sub: 'each new electric tractor needs 250+ kw of fast charging access. the utility upgrades to support that fleet are not on a 2026 timeline.',
    s2: 'we deliver energy inside the terminal gate.',
    s2sub: 'chargehubs and chargetrux on-site. no permitting boundary. no substation dependency.',
    context: `
      <h3>position</h3>
      <p>active dialogue with port of long beach operations and port of hueneme leadership. our team includes a former port-of-lb operations executive (don attore).</p>
    `
  });
  D['mkt-flagship'] = journey({
    kicker: 'market · 04',
    title: 'off-grid flagship buildings.',
    dest: 'warehouse',
    s1: 'a 500,000 sqft warehouse or industrial spec building waits 36 months for permanent service.',
    s1sub: 'the developer is paying carry on a building that cannot lease.',
    s2: 'a chargehub on-site plus scheduled energytrux deliveries.',
    s2sub: 'the building leases on solar-charged power. the tenant signs. the developer\'s carry stops.',
    context: `
      <h3>partner pipeline</h3>
      <p>relationships in development with majestic realty and hillwood — two of the largest industrial developers in the southwest, where grid-bottlenecked buildings are most concentrated.</p>
    `
  });
  D['mkt-vpp'] = {
    kicker: 'market · 05',
    title: 'grid-connected virtual power plant.',
    body: `
      <p>every energyhub and chargehub is grid-aware. when wholesale prices spike or when caiso calls a flex alert, the same assets that serve our contracted customers can export to the grid at premium rates.</p>
      <p>this is upside, not the base case. the underwriting works on contracted $/kwh-delivered alone; vpp revenue is a margin enhancer.</p>
    `
  };
  D['mkt-emergency'] = {
    kicker: 'market · 06',
    title: 'emergency & disaster response.',
    body: `
      <p>psps events, wildfires, and grid outages create episodic but high-priced demand for mobile mwh-scale power. our fleet is the only asset class that can dispatch into a fire-evacuation zone or a post-event reconstruction site at scheduled $/kwh pricing.</p>
      <p>we treat this as a strategic capability, not a forecasted revenue line.</p>
    `
  };

  // traction customers ──────────────────────────────────────────
  D['cust-avis'] = journey({
    kicker: 'traction · avis',
    title: 'avis — ev fleet electrification.',
    dest: 'rideshare',
    s1: 'avis is electrifying its rental fleet across california and the southwest.',
    s1sub: 'depot-charging capacity is the binding constraint, not vehicle supply.',
    s2: 'we deliver scheduled mwh to depot chargehubs.',
    s2sub: 'pilot under discussion for inland empire and phoenix locations.',
    context: `
      <h3>status</h3>
      <p>active commercial dialogue. structure under discussion: pilot at 1–2 sites, conversion to multi-year offtake on utilization proof.</p>
    `
  });
  D['cust-uber'] = {
    kicker: 'traction · uber private fleet',
    title: 'uber — the daily charging operation.',
    body: `
      <p>uber’s private fleet operates on a single, unforgiving rhythm: drivers need to be earning, not waiting. every kilowatt-hour we deliver has to be ready at the moment a vehicle pulls in. miss the cadence and uber’s utilization model breaks.</p>

      <h3>the contract</h3>
      <ul>
        <li><strong>executed april 2026.</strong> launch fleet operating since february 2026.</li>
        <li><strong>150 vehicles at site one,</strong> ramping to <strong>2,000 vehicles</strong> across phase one.</li>
        <li><strong>400 cars per day</strong> charging cadence at full launch capacity.</li>
        <li><strong>right of first refusal</strong> on a second california site, contractual.</li>
      </ul>

      <h3>the daily charging loop</h3>
      <p>each vehicle enters our depot 1–2 times per day for a fast top-up between fares. our chargetrux units, fed by mobile mwh containers from the energyhub, deliver <strong>150–240 kw per stall</strong> on demand — no transformer dependency, no demand charge exposure, no utility queue.</p>
      <ul>
        <li>average dwell: <strong>22–28 minutes</strong> per session.</li>
        <li>energy per session: <strong>40–60 kwh</strong>, sized to the next four-hour driving block.</li>
        <li>daily throughput per stall: <strong>18–22 sessions</strong>, peak window 11am–7pm.</li>
        <li>energy delivered per day at launch: <strong>~14 mwh</strong> to <strong>~20 mwh</strong> across the site, growing with the fleet ramp.</li>
      </ul>

      <h3>why uber chose this over fixed infrastructure</h3>
      <p>uber priced the alternative. a permanent dc fast deployment of this density would have required:</p>
      <ul>
        <li>a <strong>3–5 mw service upgrade</strong> with a 30–48 month utility queue.</li>
        <li><strong>$2.5–4m</strong> of customer-side electrical infrastructure before the first charger.</li>
        <li>permanent <strong>demand-charge exposure</strong> that erodes the per-mile economics of every electric ride.</li>
      </ul>
      <p>we are delivering the same kilowatt-hours <strong>this month</strong>, at a contracted <strong>$/kwh</strong> that uber prices into the ride. the highway, not the railroad.</p>

      <h3>the dual-site autonomy path</h3>
      <p>uber’s autonomous program needs the same fast-charging cadence with a tighter geographic footprint. site one validates the operational model; the contractual rofr on site two gives uber a clean path to a <strong>two-depot autonomy lattice</strong> in california without renegotiating energy supply. for us, it converts a single customer into a multi-site offtake before site one finishes ramp.</p>

      <h3>what this means for the platform</h3>
      <ul>
        <li>uber is our first <strong>daily-cadence, multi-shift</strong> customer — the operating template for autonomous fleets, drayage cycling, and ride-share at scale.</li>
        <li>energytrux + chargetrux are running on a <strong>scheduled freight rhythm</strong>, not opportunistic dispatch. this is the unit-economics proof point.</li>
        <li>every kwh delivered here is a <strong>marked, attributable receipt</strong> against the $24.1m external revenue target for 2027.</li>
      </ul>
    `
  };
  D['cust-polb'] = journey({
    kicker: 'traction · port of long beach',
    title: 'port of long beach — drayage electrification.',
    dest: 'drayage',
    s1: 'polb operates the densest concentration of zero-emission drayage demand in the country.',
    s1sub: 'on-terminal charging is constrained by space, permitting, and substation capacity.',
    s2: 'we deliver mwh inside the terminal gate via energytrux + chargehubs.',
    s2sub: 'a former polb operations executive sits on our team.',
    context: `
      <h3>status</h3>
      <p>active dialogue with port operations leadership. structure under discussion: a pilot drayage charging deployment with conversion to long-term capacity contract.</p>
    `
  });
  D['cust-hueneme'] = journey({
    kicker: 'traction · port of hueneme',
    title: 'port of hueneme — secondary port electrification.',
    dest: 'drayage',
    s1: 'port of hueneme is the second-largest auto-import port on the west coast.',
    s1sub: 'incoming ev imports and zero-emission yard equipment need charging that the utility timeline cannot deliver.',
    s2: 'we provide scheduled energy delivery into a portside demandhub.',
    s2sub: 'a deployment here is a template for a dozen mid-sized us ports facing identical timelines.',
    context: `
      <h3>status</h3>
      <p>discussion under nda. defining technical envelope and contract structure.</p>
    `
  });
  D['cust-flagship'] = journey({
    kicker: 'traction · flagship building',
    title: 'flagship off-grid industrial development.',
    dest: 'warehouse',
    s1: 'a >500,000 sqft industrial development is waiting on permanent service.',
    s1sub: 'tenant interest is signed-but-pending; the developer is carrying the building.',
    s2: 'on-site chargehub + scheduled energytrux deliveries.',
    s2sub: 'the building opens on solar-charged off-grid power. tenant lease commences on schedule.',
    context: `
      <h3>status</h3>
      <p>structuring conversation with a top-tier southwest industrial developer. lease-revenue economics and our $/kwh delivered both pencil at current cell pricing.</p>
    `
  });

  // scale stats ─────────────────────────────────────────────────
  D['scale-mw'] = {
    kicker: 'scale · capacity',
    title: '538 mw installed by y5.',
    body: `
      <p>this is the deployed nameplate across energyhubs, chargehubs, and demandhubs at the end of year 5. it is the unit that drives revenue, ebitda, and ITC capture.</p>
      <p>build cadence: phase-1 raise funds the first 2 energyhubs and a starter fleet of 12 energytrux. subsequent capacity is project-financed against contracted offtake.</p>
    `
  };
  D['scale-revenue'] = {
    kicker: 'scale · revenue',
    title: '$311m external revenue, y5.',
    body: `
      <p>composition at y5: roughly <strong>62%</strong> from scheduled energy delivery contracts (data center bridge, port, fleet, flagship building), <strong>18%</strong> from chargehub site economics, <strong>14%</strong> from itc monetization and tax credit transfers, <strong>6%</strong> from vpp/grid services upside.</p>
      <p>contracted revenue at y5 covers debt service by approximately 2.4×.</p>
    `
  };
  D['scale-ebitda'] = {
    kicker: 'scale · ebitda',
    title: '$203.5m ebitda, y5.',
    body: `
      <p>at scale, the platform earns infrastructure margins — not software margins, not commodity margins. fixed costs are dominated by hub generation and transport fleet capex, both of which are debt-financeable against contracted cash flow.</p>
    `
  };
  D['scale-margin'] = {
    kicker: 'scale · margin',
    title: '65% ebitda margin at scale.',
    body: `
      <p>margin expansion comes from three places: (1) hub utilization once the buffer is built, (2) fleet utilization once routing density crosses a threshold, (3) cell cost decline (we underwrite at today\'s cell pricing).</p>
    `
  };
  D['scale-cash'] = {
    kicker: 'scale · cash',
    title: '$604m cash, y5.',
    body: `
      <p>end-of-y5 cash on the balance sheet, after debt service and capex draws. this is the position from which the business funds the next stage of expansion without further equity dilution.</p>
    `
  };
  D['scale-itc'] = {
    kicker: 'scale · itc',
    title: '$253m cumulative itc.',
    body: `
      <p>investment tax credit captured across hub batteries and standalone storage. itc is monetized either against our own tax position or via transfer markets under the ira.</p>
      <p>itc is structurally a part of the underwriting. it is not the thesis, but it materially de-risks payback on the first wave of assets.</p>
    `
  };

  // model rows ──────────────────────────────────────────────────
  D['model-revenue'] = {
    kicker: 'model · revenue',
    title: 'revenue trajectory.',
    body: `<p>y1 $5.0m → y2 $24.1m → y3 $67.4m → y4 $163m → <strong>y5 $311m</strong>. driven by contracted offtake from the customer pipeline plus chargehub stack-up. y3 inflection corresponds to the first wave of energytrux fleet reaching 92% utilization across hub coverage.</p>`
  };
  D['model-ebitda'] = {
    kicker: 'model · ebitda',
    title: 'ebitda trajectory.',
    body: `<p>y1 ($2.7m) → y2 $2.3m → y3 $26.9m → y4 $92m → <strong>y5 $203.5m</strong>. breakeven in y2; mid-double-digit margin in y3; mature margin in y5.</p>`
  };
  D['model-margin'] = {
    kicker: 'model · margin',
    title: 'margin walk.',
    body: `<p>0% → 10% → 40% → 56% → 65%. expansion driven by utilization, not by pricing power. we underwrite contracts at terminal-margin pricing today.</p>`
  };
  D['model-cash'] = {
    kicker: 'model · cash',
    title: 'cash trajectory.',
    body: `<p>y1 $19m → y2 $88m → y3 $340.5m → y4 $283m → <strong>y5 $604m</strong>. the y4 dip reflects scheduled capex draws for the y5 capacity step-up. the business is self-funding by y3.</p>`
  };

  // team ────────────────────────────────────────────────────────
  D['mark'] = {
    kicker: 'founder · ceo',
    title: 'mark milius — founder & ceo.',
    body: `
      <p>founder, ceo. operator background spanning battery systems, mobile power, and infrastructure development. sets product, strategy, and capital posture for energyforward.</p>
      <p>directly accountable for the platform thesis (energyforward is to the electrical grid what the highway and trucking system was to the railroad) and for the phase-1 deployment milestones.</p>
    `
  };
  D['nate'] = {
    kicker: 'founder · cto',
    title: 'nate schroeder — cto.',
    body: `
      <p>7th employee at one energy. led the 752-mile gemini drive that proved continuous mobile battery operation at class-8 scale. deep experience in lfp pack engineering, bms, and 9540a-tested cabinet design.</p>
      <p>owns the energytrux, chargetrux, and container engineering roadmap end-to-end.</p>
    `
  };
  D['ed'] = {
    kicker: 'founder · cio',
    title: 'ed feo — cio.',
    body: `
      <p>former partner, milbank. led $35b+ in renewable energy and infrastructure financings. one of the most cited project-finance attorneys in u.s. solar and storage.</p>
      <p>structures our capital stack: equity, project debt, itc transfer, and contracted-offtake-backed credit.</p>
    `
  };
  D['don'] = {
    kicker: 'founder · port',
    title: 'don attore — port operations.',
    body: `
      <p>former port of long beach operations executive. brings direct access to drayage operators, terminal leadership, and the regulatory bodies governing the zero-emission deadline.</p>
      <p>owns the port-segment customer relationships.</p>
    `
  };
  D['colin'] = {
    kicker: 'founder · clo',
    title: 'colin mues — chief legal officer.',
    body: `
      <p>regulatory and corporate counsel. accountable for permitting, hazmat-9 transport compliance, contract architecture, and ferc/cpuc engagement.</p>
    `
  };
  D['scott'] = {
    kicker: 'founder · fleet finance',
    title: 'scott reising — md, fleet finance.',
    body: `
      <p>former managing director, bridge bank. $450m+ in originated fleet and equipment finance. structures the energytrux asset financing — converting each container + tractor into a debt-financeable unit against contracted $/kwh.</p>
    `
  };

  // advisors ────────────────────────────────────────────────────
  D['adv-kelly'] = {
    kicker: 'advisor · utility',
    title: 'jim kelly — 38 years, southern california edison.',
    body: `<p>former senior vp, transmission & distribution, sce. brings the railroad\'s view of the highway — and validates that the two industries are complementary, not adversarial.</p>`
  };
  D['adv-massie'] = {
    kicker: 'advisor · logistics',
    title: 'noel massie — former vp us ops, ups.',
    body: `<p>ran ups u.s. ground operations. validates the freight-logistics model underlying energytrux dispatch and return logistics.</p>`
  };
  D['adv-talt'] = {
    kicker: 'advisor · real estate',
    title: 'taylor talt — majestic realty.',
    body: `<p>senior executive at majestic realty, a >$1b industrial developer. positions us inside the off-grid flagship building opportunity.</p>`
  };
  D['adv-morse'] = {
    kicker: 'advisor · real estate',
    title: 'scott morse — hillwood.',
    body: `<p>executive at hillwood, the >$10b ross perot jr industrial development platform. extends our flagship-building reach across the southwest.</p>`
  };
  D['adv-hagg'] = {
    kicker: 'advisor · capital',
    title: 'rob hagg — fortis capital.',
    body: `<p>chief growth officer, fortis capital. structures and underwrites infrastructure debt in our sector.</p>`
  };

  // use of funds ────────────────────────────────────────────────
  D['uof-energyhubs'] = {
    kicker: 'use of funds · hubs',
    title: 'energyhubs — first two sites.',
    body: `<p>the phase-1 raise funds the first two energyhubs (50 mw solar + 200 mwh storage each), including land acquisition, interconnect filings, eng/proc/construction, and commissioning.</p>`
  };
  D['uof-drayage'] = {
    kicker: 'use of funds · drayage',
    title: 'drayage charging deployment.',
    body: `<p>funds the initial drayage chargehubs and the energytrux units that serve them, sized to first-customer commitments at the port segment.</p>`
  };
  D['uof-evfinance'] = {
    kicker: 'use of funds · fleet finance',
    title: 'ev finance & fleet build.',
    body: `<p>seed capital for the energytrux and chargetrux fleet, structured as the equity tranche under the asset-finance facility scott reising builds against contracted $/kwh-delivered.</p>`
  };
  D['uof-team'] = {
    kicker: 'use of funds · team',
    title: 'team build-out.',
    body: `<p>founding-team hiring across engineering, operations, finance, and bd. concentrated on roles with execution risk in the first 18 months.</p>`
  };
  D['uof-wc'] = {
    kicker: 'use of funds · working capital',
    title: 'working capital & operations.',
    body: `<p>standard operating runway plus a contingency reserve sized to the first deployment cycle.</p>`
  };

  // ─── expose ───────────────────────────────────────────────────
  window.DIVES = D;
  window.DIVE_DEST = DEST;

})();

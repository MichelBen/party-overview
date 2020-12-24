import Tooltip from "../tooltip/index.js";

const DISPLAY_MODE = {
  SHOW_ALL: "SHOW_ALL",
  SHOW_HIDDEN: "SHOW_HIDDEN",
  SHOW_VISIBLE: "SHOW_VISIBLE",
};

const SIMPLE_SYTEMS = ['swade'];

class App extends Application {
  constructor(options) {
    super(options);

    this.hiddenActors = [];
    this.state = {};
    this.displayMode = DISPLAY_MODE.SHOW_VISIBLE;
    this.activeTab = "general";

    // initialize
    // this.update();
    Hooks.on("hoverToken", this.onHoverToken.bind(this));
  }

  setTooltip(tooltip) {
    this.tooltip = tooltip;
  }

  update() {
    let actors = game.actors.entities
      .filter(a => a.hasPlayerOwner)
      .map(playerActor => playerActor.getActiveTokens())
      .flat(1)
      .map(token => token.actor);

    // remove duplicates if an actors has multiple tokens on scene
    actors = actors.reduce(
      (actors, actor) => (actors.map(a => a.id).includes(actor.id) ? actors : [...actors, actor]),
      []
    );

    switch (this.displayMode) {
      case DISPLAY_MODE.SHOW_HIDDEN:
        actors = actors.filter(actor => this.hiddenActors.includes(actor.id));
        break;
      case DISPLAY_MODE.SHOW_VISIBLE:
        actors = actors.filter(actor => !this.hiddenActors.includes(actor.id));
        break;
    }

    actors = actors.map(actor => {
      const data = actor.data.data;
      return this.getActorDetails(actor);
    });

    let languages;
    let totalCurrency;
    if (! SIMPLE_SYTEMS.includes(game.system.id)) {
      // restructure the languages a bit so rendering gets easier
      languages = actors
        .reduce((languages, actor) => [...new Set(languages.concat(actor.languages))], [])
        .filter(language => language !== undefined)
        .sort();
      actors = actors.map(actor => {
        return {
          ...actor,
          languages: languages.map(language => actor.languages && actor.languages.includes(language)),
        };
      });
      totalCurrency = actors.reduce(
        (currency, actor) => {
          for (let prop in actor.currency) {
            currency[prop] += actor.currency[prop];
          }
          return currency;
        },
        {
          cp: 0,
          sp: 0,
          ep: 0,
          gp: 0,
          pp: 0,
        }
      );
      // summing up the total
	  /*
      const calcOverflow = (currency, divider) => {
        return {
          remainder: currency % divider,
          overflow: Math.floor(currency / divider),
        };
      };

      console.log(totalCurrency);

      let overflow = calcOverflow(totalCurrency.cp, 10);
      totalCurrency.cp = overflow.remainder;
      totalCurrency.sp += overflow.overflow;
      overflow = calcOverflow(totalCurrency.sp, 5);
      totalCurrency.sp = overflow.remainder;
      totalCurrency.ep += overflow.overflow;
      overflow = calcOverflow(totalCurrency.ep, 2);
      totalCurrency.ep = overflow.remainder;
      totalCurrency.gp += overflow.overflow;
      overflow = calcOverflow(totalCurrency.gp, 10);
      totalCurrency.gp = overflow.remainder;
      totalCurrency.pp += overflow.overflow;

      console.log(totalCurrency);
*/
    }

	let totalPartyGP = actors.reduce((totalGP, actor) => totalGP + parseFloat(actor.totalGP), 0).toFixed(2);

    this.state = {
      activeTab: this.activeTab,
      mode: this.displayMode,
      name: "Sebastian",
      actors: actors,
      languages: languages,
      totalCurrency: totalCurrency,
	  totalPartyGP: totalPartyGP,
    };
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      width: 500,
      height: 300,
      resizable: true,
      title: "VTTA Party",
      template: `/modules/vtta-party/templates/${game.system.id}.hbs`,
      classes: ["vtta", "party", game.system.id],
      tabs: [
        {
          navSelector: ".tabs",
          contentSelector: ".content",
          initial: "general",
        },
      ],
    });
  }

  getData() {
    this.update();
    return this.state;
  }
  
    getTotalGP(currency) {
    // summing up the total
    const calcOverflow = (currency, divider) => {
      return {
        remainder: currency % divider,
        overflow: Math.floor(currency / divider),
      };
    };
    let gold = currency.cp / 100 + currency.sp / 10 + currency.ep / 2 + currency.gp + currency.pp * 10;
    return gold;
  }

  htmlDecode(input) {
    var doc = new DOMParser().parseFromString(input, "text/html");
    return doc.documentElement.textContent;
  }

  getActorDetails(actor) {
    const data = actor.data.data;

    if (game.system.id === "dnd5e") {
      const getHitpoints = hp => {
        const value = parseInt(hp.value);
        const max = parseInt(hp.max);
        const tempValue = isNaN(parseInt(data.attributes.hp.temp)) ? 0 : parseInt(data.attributes.hp.temp);
        const tempMaxValue = isNaN(parseInt(data.attributes.hp.tempmax)) ? 0 : parseInt(data.attributes.hp.tempmax);

        return {
          value: value,
          max: max,
          tempValue: tempValue,
          tempMaxValue: tempMaxValue,
          totalValue: value + tempValue,
          totalMaxValue: max + tempMaxValue,
        };
      };
      
      const getSpeed = move => {
        let extra = [];
        if (move.fly)    extra.push(`${move.fly} ${move.units} fly`);
        if (move.hover)  extra.push("hover");
        if (move.burrow) extra.push(`${move.burrow} ${move.units} burrow`);
        if (move.swim)   extra.push(`${move.swim} ${move.units} swim`);
        if (move.climb)  extra.push(`${move.climb} ${move.units} climb`);

        let str = `${move.walk} ${move.units}`;
        if (extra.length)
          str += ` (${extra.join(", ")})`;

        return str;
      };

      return {
        id: actor.id,
        isHidden: this.hiddenActors.includes(actor.id),
        name: actor.name,
        shortName: actor.name.split(/\s/).shift(),
        shortestName:
          actor.name.split(/\s/).shift().length > 10
            ? actor.name.split(/\s/).shift().substr(0, 10) + "…"
            : actor.name.split(/\s/).shift().substr(0, 10),
        hp: getHitpoints(data.attributes.hp),
        ac: data.attributes.ac.value ? data.attributes.ac.value : 10,
        spellDC: data.attributes.spelldc,
        speed: getSpeed(data.attributes.movement),

        // passive stuff
        passives: {
          perception: data.skills.prc.passive,
          investigation: data.skills.inv.passive,
          insight: data.skills.ins.passive,
          stealth: data.skills.ste.passive,
        },
        // background
        background: {
          trait: this.htmlDecode(data.details.trait),
          ideal: this.htmlDecode(data.details.ideal),
          bond: this.htmlDecode(data.details.bond),
          flaw: this.htmlDecode(data.details.flaw)
        },
        // details
        inspiration: data.attributes.inspiration,
        languages: data.traits.languages.value.map(code => CONFIG.DND5E.languages[code]),
        alignment: data.details.alignment,
        currency: data.currency,
		totalGP: this.getTotalGP(data.currency).toFixed(2),
      };
    }

    if (game.system.id === "pf2e") {
      return {
        id: actor.id,
        isHidden: this.hiddenActors.includes(actor.id),
        name: actor.name,
        shortName: actor.name.split(/\s/).shift(),
        shortestName:
          actor.name.split(/\s/).shift().length > 10
            ? actor.name.split(/\s/).shift().substr(0, 10) + "…"
            : actor.name.split(/\s/).shift().substr(0, 10),
        hp: {
          value: data.attributes.hp.value,
          max: data.attributes.hp.max,
        },
        ac: data.attributes.ac.value ? data.attributes.ac.value : 10,
        shieldAC: data.attributes.shield && data.attributes.shield.ac ? `(+${data.attributes.shield.ac})` : "",
        perception: data.attributes.perception.value,
        stealth: data.skills.ste.value,
        speed: data.attributes.speed.value,

        // passive stuff
        saves: {
          fortitude: data.saves.fortitude.value,
          reflex: data.saves.reflex.value,
          will: data.saves.will.value,
        },

        // details
        languages: data.traits.languages.value.map(code => CONFIG.PF2E.languages[code]),
      };
    }

    if (game.system.id === "wfrp4e") {
      return {
        id: actor.id,
        isHidden: this.hiddenActors.includes(actor.id),
        name: actor.name,
        shortName: actor.name.split(/\s/).shift(),
        shortestName:
          actor.name.split(/\s/).shift().length > 10
            ? actor.name.split(/\s/).shift().substr(0, 10) + "…"
            : actor.name.split(/\s/).shift().substr(0, 10),
        wounds: {
          value: data.status.wounds.value,
          max: data.status.wounds.max,
        },
        advantage: data.status.advantage.value,
        movement: data.details.move.value,
        walk: data.details.move.walk,
        run: data.details.move.run,
      };
    }

    if (game.system.id === 'swade') {
      let armor
      if (actor.data.data.stats.toughness.armor > 0) {
        armor = actor.data.data.stats.toughness.armor
      }
      return {
        id: actor.id,
        isHidden: this.hiddenActors.includes(actor.id),
        name: actor.name,
        current_wounds: actor.data.data.wounds.value,
        max_wounds: actor.data.data.wounds.max,
        current_fatigue: actor.data.data.fatigue.value,
        max_fatigue: actor.data.data.fatigue.max,
        bennies: actor.data.data.bennies.value,
        parry: actor.data.data.stats.parry.value,
        toughness: actor.data.data.stats.toughness.value,
        armor: armor
      };
    }
  }

  activateListeners(html) {
    $(".btn-toggle-visibility").on("click", event => {
      const actorId = event.currentTarget.dataset.actor;
      this.hiddenActors = this.hiddenActors.includes(actorId)
        ? this.hiddenActors.filter(id => id !== actorId)
        : [...this.hiddenActors, actorId];
      this.render(false);
    });

    $(".btn-filter").on("click", event => {
      this.displayMode =
        this.displayMode === DISPLAY_MODE.SHOW_ALL
          ? DISPLAY_MODE.SHOW_VISIBLE
          : this.displayMode === DISPLAY_MODE.SHOW_VISIBLE
          ? DISPLAY_MODE.SHOW_HIDDEN
          : DISPLAY_MODE.SHOW_ALL;
      this.render(false);
    });

    //  $('span[name="hpCurrent"]', html).on("mouseover", event => {
    //     console.log("mouseover");
    //     const data = event.currentTarget.dataset;
    //     $(event.currentTarget).val(`${data.value} (+${data.temp})`);
    //     console.log(data);
    //   });

    $('span[name="hpCurrent"], span[name="hpMax"]', html).hover(
      function () {
        const data = $(this).data();
        $(this).text(data.temp ? `${data.value} (+${data.temp})` : data.value);
      },
      function () {
        const data = $(this).data();
        $(this).text(`${data.total}`);
      }
    );

    super.activateListeners(html);
  }

  onHoverToken(token, hovered) {
    if (!this.tooltip) {
      console.log("Tooltip not initialized");
      return;
    }
    if (!game.settings.get("vtta-party", "EnableTooltip")) return;
    if (!game.user.isGM && !game.settings.get("vtta-party", "EnablePlayerAccessTooltip")) return;
    if (!token || !token.actor) return;

    if (!hovered) {
      this.tooltip.hide();
      //canvas.tokens.removeChild(this.tooltip.container);
      return;
    }

    // else collect the actor data, update the tooltip, relocate and show it
    let canvasToken = canvas.tokens.ownedTokens.find(ownedToken => ownedToken.id === token.id);

    if (!canvasToken) return;

    let data;
    let seenBy;
    if (token.actor.hasPlayerOwner) {
      data = this.state.actors.find(actor => actor.id === token.actor.id);
    } else {
      // could be a mob
      data = this.getActorDetails(token.actor);
      seenBy = "No-one";
      if (token.data.hidden) {
        if (game.system.id === "dnd5e") {
          seenBy = this.state.actors
            .filter(actor => actor.passives.perception >= data.passives.stealth)
            .map(actor => actor.name)
            .join(", ");
        }
        if (game.system.id === "pf2e") {
          seenBy = this.state.actors
            .filter(actor => actor.perception >= data.stealth)
            .map(actor => actor.name)
            .join(", ");
        }
      }
    }

    if (!data) return;
    let lines;

    if (game.system.id === "dnd5e") {
      // this blanks the temp hitpoints if it is a zero-value
      // return {
      //   value: value,
      //   max: max,
      //   tempValue: tempValue,
      //   tempMaxValue: tempMaxValue,
      //   totalValue: value + tempValue,
      //   totalMaxValue: max + tempMaxValue,
      // };

      const temporaryHitpoints = data.hp.tempValue ? ` (+${data.hp.tempValue})` : "";
      const tempMaxHitpoints = data.hp.tempMaxValue ? ` (+${data.hp.tempMaxValue})` : "";
      lines = [
        {
          label: "Health",
          value: `${data.hp.value + data.hp.tempValue}${temporaryHitpoints} / ${
            data.hp.max + data.hp.tempMaxValue
          }${tempMaxHitpoints}`,
        },
      ];
      lines.push(
        { label: "Armor Class", value: data.ac },
        { label: "Speed", value: data.speed },
        { label: "Passive Perception", value: data.passives.perception },
        { label: "Passive Investigation", value: data.passives.investigation },
        { label: "Passive Insight", value: data.passives.insight }
      );

      if (token.data.hidden) {
        if (seenBy) {
          lines.unshift({ label: "Noticable by", value: seenBy });
        } else {
          lines.unshift({ label: "Noticable by", value: "Undetectable" });
        }
      }
    }

    if (game.system.id === "pf2e") {
      let ac = `${data.ac}`;
      if (data.shieldAC !== "") {
        ac += " " + data.shieldAC;
      }
      lines = [
        { label: "Health", value: `${data.hp.value} / ${data.hp.max}` },
        { label: "Armor Class", value: ac },
        { label: "Speed", value: data.speed },
        { label: "Perception", value: data.perception },
        {
          label: "F / R / W",
          value: `${data.saves.fortitude} / ${data.saves.reflex} / ${data.saves.will}`,
        },
      ];
    }

    if (game.system.id === "wfrp4e") {
      lines = [
        {
          label: game.i18n.localize("Wounds"),
          value: `${data.wounds.value} / ${data.wounds.max}`,
        },
        { label: game.i18n.localize("Advantage"), value: data.advantage },
        { label: game.i18n.localize("Movement"), value: data.movement },
        {
          label: game.i18n.localize("Walk"),
          value: data.walk + " " + game.i18n.localize("yds"),
        },
        {
          label: game.i18n.localize("Run"),
          value: data.run + " " + game.i18n.localize("yds"),
        },
      ];
    }

    if (game.system.id === 'swade') {
      let armor = '';
      if (data.armor) {
        armor = `(${data.armor})`
      }
      lines = [
          {label: "Bennies", value: data.bennies},
          {label: "Wounds", value: `${data.current_wounds}/${data.max_wounds}`},
          {label: "Fatigue", value: `${data.current_fatigue}/${data.max_fatigue}`},
          {label: "Parry", value: data.parry},
          {label: "Toughness (Armor)", value: `${data.toughness} ${armor}`}
      ];
    }

    this.tooltip.updateTooltip(
      {
        x: canvasToken.center.x,
        y: canvasToken.center.y - Math.floor(canvasToken.w / 2),
      },
      lines
    );
  }
}

export default App;

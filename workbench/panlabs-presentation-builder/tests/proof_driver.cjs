// The four assertions, written once, for every Node proof in this suite.
//
// A straight port of `proof_driver.py` -- not a require() of it, because
// Node cannot import a Python module. #157 is the first render-gate proof
// and the only one so far written in Node (`measureFile` needs a real
// Chromium, which is a Node/CDP concern, not a Python one); if a second
// Node proof ever lands, IT reads this file rather than copying it, for
// exactly the reason `proof_driver.py`'s own docstring gives: two copies of
// a rule that drift is the failure mode this whole suite exists to refuse.
//
// ADR 0001's standard is four, and they are these:
//
//   planted   the mutated input really differs from the real one. Without
//             this a drifted fixture plants NOTHING and the case still
//             passes the other three by accident -- the exact way a proof
//             rots silently.
//   red       the check goes red on it.
//   message   the red NAMES ITS OWN FIX. A red that does not say what to do
//             is a red people learn to ignore.
//   green     the same check, with nothing planted, is green AGAINST THE
//             REAL CORPUS. A proof with no real control measures the author
//             of the check, not the check.
//
// The file has no hyphen in its name because it is required, not run.
// Every other file here is a command and carries the house's hyphen.

class Drifted extends Error {}

class Proof {
  // invoke(key, payload)  -> [ok, message] for a planted payload
  // planted(payload)      -> true when the payload really differs from real
  // control(key)          -> [ok, message] with nothing planted at all
  constructor({ title, label, invoke, planted, control, width = 19 }) {
    this.title = title;
    this.label = label;
    this.invoke = invoke;
    this.planted = planted;
    this.control = control;
    this.width = width;
    this._told = new Set();
  }

  // The control, reported in full only ONCE per key. Several cases share
  // one control, and printing the same paragraph four times buries the tag
  // that says which assertion actually failed.
  async _green(key) {
    const [ok, msg] = await this.control(key);
    if (!ok) {
      const shown = this._told.has(key) ? '(same as above)' : msg;
      this._told.add(key);
      return [ok, shown];
    }
    return [ok, msg];
  }

  async case(key, what, plant, mustSay) {
    const marks = [];
    const why = [];
    let planted = false;
    let payload = null;

    try {
      payload = await plant();
      planted = this.planted(payload);
      if (!planted) why.push('the plant changed nothing');
    } catch (e) {
      if (e instanceof Drifted) {
        why.push(`fixture drifted: ${e.message}`);
      } else {
        throw e;
      }
    }
    marks.push(planted);

    let red = false;
    let says = false;
    let msg = '';
    if (planted) {
      try {
        const [ok, m] = await this.invoke(key, payload);
        msg = m;
        red = !ok;
      } catch (e) {
        msg = `${e.constructor.name}: ${e.message}`;
        red = true;
      }
      says = msg.toLowerCase().includes(mustSay.toLowerCase());
      if (!red) why.push('stayed GREEN');
      else if (!says) why.push(`the red never says ${JSON.stringify(mustSay)}`);
    }
    marks.push(red, says);

    const [green, gmsg] = await this._green(key);
    if (!green) why.push(`green control is RED: ${gmsg}`);
    marks.push(green);

    const good = marks.every(Boolean);
    const tag = marks.map((m) => (m ? '+' : '-')).join('');
    const name = this.label(key);
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${name.padEnd(this.width)} [${tag}] ${what}`);
    if (good) {
      console.log(`       red: ${msg}`);
    } else {
      for (const w of why) console.log(`       <- ${w}`);
    }
    return good;
  }

  // Every case, in order. Returns the number that failed.
  async run(cases) {
    console.log(`${this.title}:  [planted red message green]`);
    let bad = 0;
    for (const c of cases) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await this.case(...c))) bad += 1;
    }
    return bad;
  }

  refuse(why) {
    console.log(`${this.title}:  [planted red message green]`);
    console.log(`  FAIL ${'setup'.padEnd(this.width)} ${why}`);
    return 1;
  }
}

module.exports = { Drifted, Proof };

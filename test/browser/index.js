/** @jsx hJSX */
'use strict';
/* global describe, it, beforeEach */
let assert = require('assert');
let Cycle = require('@cycle/core');
let CycleDOM = require('../../src/cycle-dom');
let Rx = require('@reactivex/rxjs');
let {h, hJSX, makeDOMDriver, svg} = CycleDOM;

function createRenderTarget(id = null) {
  let element = document.createElement('div');
  element.className = 'cycletest';
  if (id) {
    element.id = id;
  }
  document.body.appendChild(element);
  return element;
}

describe('makeDOMDriver', function () {
  it('should accept a DOM element as input', function () {
    let element = createRenderTarget();
    assert.doesNotThrow(function () {
      makeDOMDriver(element);
    });
  });

  it('should accept a DocumentFragment as input', function () {
    let element = document.createDocumentFragment();
    assert.doesNotThrow(function () {
      makeDOMDriver(element);
    });
  });

  it('should accept a string selector to an existing element as input', function () {
    let id = 'testShouldAcceptSelectorToExisting';
    let element = createRenderTarget();
    element.id = id;
    assert.doesNotThrow(function () {
      makeDOMDriver('#' + id);
    });
  });

  it('should not accept a selector to an unknown element as input', function () {
    assert.throws(function () {
      makeDOMDriver('#nonsenseIdToNothing');
    }, /Cannot render into unknown element/);
  });

  it('should not accept a number as input', function () {
    assert.throws(function () {
      makeDOMDriver(123);
    }, /Given container is not a DOM element neither a selector string/);
  });
});

describe('DOM Driver', function () {
  it('should throw if input is not an Observable<VTree>', function () {
    let domDriver = makeDOMDriver(createRenderTarget());
    assert.throws(function () {
      domDriver({});
    }, /The DOM driver function expects as input an Observable of virtual/);
  });

  it('should have Observable `:root` in response', function (done) {
    function app() {
      return {
        DOM: Rx.Observable.of(
          h('div.top-most', [
            h('p', 'Foo'),
            h('span', 'Bar')
          ])
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });

    responses.DOM.select(':root').observable.skip(1).take(1).subscribe(root => {
      let classNameRegex = /top\-most/;
      assert.strictEqual(root.tagName, 'DIV');
      let child = root.children[0];
      assert.notStrictEqual(classNameRegex.exec(child.className), null);
      assert.strictEqual(classNameRegex.exec(child.className)[0], 'top-most');
      responses.dispose();
      done();
    });
  });

  it('should convert a simple virtual-dom <select> to DOM element', function (done) {
    function app() {
      return {
        DOM: Rx.Observable.of(h('select.my-class', [
          h('option', {value: 'foo'}, 'Foo'),
          h('option', {value: 'bar'}, 'Bar'),
          h('option', {value: 'baz'}, 'Baz')
        ]))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });
    responses.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
      let selectEl = root.querySelector('.my-class');
      assert.notStrictEqual(selectEl, null);
      assert.notStrictEqual(typeof selectEl, 'undefined');
      assert.strictEqual(selectEl.tagName, 'SELECT');
      responses.dispose();
      done();
    });
  });

  it('should convert a simple virtual-dom <select> (JSX) to DOM element', function (done) {
    function app() {
      return {
        DOM: Rx.Observable.of(
          <select className="my-class">
            <option value="foo">Foo</option>
            <option value="bar">Bar</option>
            <option value="baz">Baz</option>
          </select>
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });
    responses.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
      let selectEl = root.querySelector('.my-class');
      assert.notStrictEqual(selectEl, null);
      assert.notStrictEqual(typeof selectEl, 'undefined');
      assert.strictEqual(selectEl.tagName, 'SELECT');
      responses.dispose();
      done();
    });
  });

  it('should allow virtual-dom Thunks in the VTree', function (done) {
    // The thunk
    let ConstantlyThunk = function(greeting){
      this.greeting = greeting;
    };
    ConstantlyThunk.prototype.type = 'Thunk';
    ConstantlyThunk.prototype.render = function(previous) {
      debugger;
      if (previous && previous.vnode) {
        return previous.vnode;
      } else {
        return h('h4', 'Constantly ' + this.greeting);
      }
    };
    // The Cycle.js app
    function app() {
      return {
        DOM: Rx.Observable.interval(10).take(5).map(i =>
            h('div', [
              new ConstantlyThunk('hello' + i)
            ])
        )
      };
    }

    // Run it
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });

    // Assert it
    responses.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
      let selectEl = root.querySelector('h4');
      assert.notStrictEqual(selectEl, null);
      assert.notStrictEqual(typeof selectEl, 'undefined');
      assert.strictEqual(selectEl.tagName, 'H4');
      assert.strictEqual(selectEl.textContent, 'Constantly hello0');
      responses.dispose();
      done();
    });
  });

  it('should allow plain virtual-dom Widgets in the VTree', function (done) {
    // The widget
    const MyTestWidget = function (content) {
      this.content = content;
    };
    MyTestWidget.prototype.type = 'Widget';
    MyTestWidget.prototype.init = function() {
      const divElem = document.createElement('H4');
      const textElem = document.createTextNode('Content is ' + this.content);
      divElem.appendChild(textElem);
      return divElem;
    }
    MyTestWidget.prototype.update = function(previous, domNode) {
      return null
    }

    // The Cycle.js app
    function app() {
      return {
        DOM: Rx.Observable.of(h('div.top-most', [
          h('p', 'Just a paragraph'),
          new MyTestWidget('hello world')
        ]))
      };
    }

    // Run it
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });

    // Assert it
    responses.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
      let selectEl = root.querySelector('h4');
      assert.notStrictEqual(selectEl, null);
      assert.notStrictEqual(typeof selectEl, 'undefined');
      assert.strictEqual(selectEl.tagName, 'H4');
      assert.strictEqual(selectEl.textContent, 'Content is hello world');
      responses.dispose();
      done();
    });
  });

  it('should catch interaction events coming from wrapped View', function (done) {
    // Make a View reactively imitating another View
    function app() {
      return {
        DOM: Rx.Observable.of(h('h3.myelementclass', 'Foobar'))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });
    // Make assertions
    responses.DOM.select('.myelementclass').events('click').subscribe(ev => {
      assert.strictEqual(ev.type, 'click');
      assert.strictEqual(ev.target.textContent, 'Foobar');
      responses.dispose();
      done();
    });
    responses.DOM.select(':root').observable.skip(1).take(1)
      .subscribe(function (root) {
        let myElement = root.querySelector('.myelementclass');
        assert.notStrictEqual(myElement, null);
        assert.notStrictEqual(typeof myElement, 'undefined');
        assert.strictEqual(myElement.tagName, 'H3');
        assert.doesNotThrow(function () {
          myElement.click();
        });
      });
  });

  it('should catch interaction events using id in DOM.select(cssSelector).events(event)', function (done) {
    function app() {
      return {
        DOM: Rx.Observable.of(h('h3.myelementclass', 'Foobar'))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget('parent-001'))
    });
    // Make assertions
    responses.DOM.select('#parent-001').events('click').subscribe(ev => {
      assert.strictEqual(ev.type, 'click');
      assert.strictEqual(ev.target.textContent, 'Foobar');
      responses.dispose();
      done();
    });
    responses.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
      let myElement = root.querySelector('.myelementclass');
      assert.notStrictEqual(myElement, null);
      assert.notStrictEqual(typeof myElement, 'undefined');
      assert.strictEqual(myElement.tagName, 'H3');
      assert.doesNotThrow(function () {
        myElement.click();
      });
    });
  });

  it('should catch user events using DOM.select().events()', function (done) {
    function app() {
      return {
        DOM: Rx.Observable.of(h('h3.myelementclass', 'Foobar'))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });
    // Make assertions
    responses.DOM.select('.myelementclass').events('click').subscribe(ev => {
      assert.strictEqual(ev.type, 'click');
      assert.strictEqual(ev.target.textContent, 'Foobar');
      responses.dispose();
      done();
    });
    responses.DOM.select(':root').observable.skip(1).take(1)
      .subscribe(function (root) {
        let myElement = root.querySelector('.myelementclass');
        assert.notStrictEqual(myElement, null);
        assert.notStrictEqual(typeof myElement, 'undefined');
        assert.strictEqual(myElement.tagName, 'H3');
        assert.doesNotThrow(function () {
          myElement.click();
        });
      });
  });

  it('should catch events from many elements using DOM.select().events()', function (done) {
    function app() {
      return {
        DOM: Rx.Observable.of(h('div.parent', [
          h('h4.clickable.first', 'First'),
          h('h4.clickable.second', 'Second'),
        ]))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });
    let clicks = [];
    // Make assertions
    responses.DOM.select('.clickable').events('click').elementAt(0)
      .subscribe(ev => {
        assert.strictEqual(ev.type, 'click');
        assert.strictEqual(ev.target.textContent, 'First');
      });
    responses.DOM.select('.clickable').events('click').elementAt(1)
      .subscribe(ev => {
        assert.strictEqual(ev.type, 'click');
        assert.strictEqual(ev.target.textContent, 'Second');
        responses.dispose();
        done();
      });
    responses.DOM.select(':root').observable.skip(1).take(1)
      .subscribe(function (root) {
        let firstElem = root.querySelector('.first');
        let secondElem = root.querySelector('.second');
        assert.notStrictEqual(firstElem, null);
        assert.notStrictEqual(typeof firstElem, 'undefined');
        assert.notStrictEqual(secondElem, null);
        assert.notStrictEqual(typeof secondElem, 'undefined');
        assert.doesNotThrow(function () {
          firstElem.click();
          setTimeout(() => secondElem.click(), 1);
        });
      });
  });

  it('should catch interaction events using id in DOM.select', function (done) {
    function app() {
      return {
        DOM: Rx.Observable.of(h('h3.myelementclass', 'Foobar'))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget('parent-002'))
    });
    // Make assertions
    responses.DOM.select('#parent-002').events('click').subscribe(ev => {
      assert.strictEqual(ev.type, 'click');
      assert.strictEqual(ev.target.textContent, 'Foobar');
      responses.dispose();
      done();
    });
    responses.DOM.select(':root').observable.skip(1).take(1)
      .subscribe(function (root) {
        let myElement = root.querySelector('.myelementclass');
        assert.notStrictEqual(myElement, null);
        assert.notStrictEqual(typeof myElement, 'undefined');
        assert.strictEqual(myElement.tagName, 'H3');
        assert.doesNotThrow(function () {
          myElement.click();
        });
      });
  });

  describe('DOM.select()', function () {
    it('should be an object with observable and events()', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.of(h('h3.myelementclass', 'Foobar'))
        };
      }
      let [requests, responses] = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      // Make assertions
      const selection = responses.DOM.select('.myelementclass');
      assert.strictEqual(typeof selection, 'object');
      assert.strictEqual(typeof selection.observable, 'object');
      assert.strictEqual(typeof selection.observable.subscribe, 'function');
      assert.strictEqual(typeof selection.events, 'function');
      responses.dispose();
      done();
    });

    it('should have an observable of DOM elements', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.of(h('h3.myelementclass', 'Foobar'))
        };
      }
      let [requests, responses] = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      // Make assertions
      responses.DOM.select('.myelementclass').observable.skip(1).take(1)
        .subscribe(elem => {
          assert.notStrictEqual(elem, null);
          assert.notStrictEqual(typeof elem, 'undefined');
          // Is a NodeList
          assert.strictEqual(Array.isArray(elem), false);
          assert.strictEqual(elem.length, 1);
          // NodeList with the H3 element
          assert.strictEqual(elem[0].tagName, 'H3');
          assert.strictEqual(elem[0].textContent, 'Foobar');
          responses.dispose();
          done();
        });
    });
  });

  it('should allow subscribing to interactions', function (done) {
    // Make a View reactively imitating another View
    function app() {
      return {
        DOM: Rx.Observable.of(h('h3.myelementclass', 'Foobar'))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });
    responses.DOM.select('.myelementclass').events('click').subscribe(ev => {
      assert.strictEqual(ev.type, 'click');
      assert.strictEqual(ev.target.textContent, 'Foobar');
      responses.dispose();
      done();
    });
    // Make assertions
    responses.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
      let myElement = root.querySelector('.myelementclass');
      assert.notStrictEqual(myElement, null);
      assert.notStrictEqual(typeof myElement, 'undefined');
      assert.strictEqual(myElement.tagName, 'H3');
      assert.doesNotThrow(function () {
        myElement.click();
      });
    });
  });

  it('should render a VTree with a child Observable<VTree>', function (done) {
    function app() {
      let child$ = Rx.Observable.of(
        h('h4.child', {}, 'I am a kid')
      ).delay(80);
      return {
        DOM: Rx.Observable.of(h('div.my-class', [
          h('p', {}, 'Ordinary paragraph'),
          child$
        ]))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });
    responses.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
      let selectEl = root.querySelector('.child');
      assert.notStrictEqual(selectEl, null);
      assert.notStrictEqual(typeof selectEl, 'undefined');
      assert.strictEqual(selectEl.tagName, 'H4');
      assert.strictEqual(selectEl.textContent, 'I am a kid');
      responses.dispose();
      done();
    });
  });

  it('should render a VTree with a grandchild Observable<VTree>', function (done) {
    function app() {
      let grandchild$ = Rx.Observable
        .of(
        h('h4.grandchild', {}, [
          'I am a baby'
        ])
      )
        .delay(20);
      let child$ = Rx.Observable
        .of(
        h('h3.child', {}, [
          'I am a kid', grandchild$
        ])
      )
        .delay(80);
      return {
        DOM: Rx.Observable.of(h('div.my-class', [
          h('p', {}, 'Ordinary paragraph'),
          child$
        ]))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });
    responses.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
      let selectEl = root.querySelector('.grandchild');
      assert.notStrictEqual(selectEl, null);
      assert.notStrictEqual(typeof selectEl, 'undefined');
      assert.strictEqual(selectEl.tagName, 'H4');
      assert.strictEqual(selectEl.textContent, 'I am a baby');
      responses.dispose();
      done();
    });
  });

  // Important! Modified range because of timing issues
  it('should not work after has been disposed', function (done) {
    let number$ = Rx.Observable.range(1, 10)
      .concatMap(x => Rx.Observable.of(x).delay(50));
    function app() {
      return {
        DOM: number$.map(number =>
            h('h3.target', String(number))
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });
    responses.DOM.select(':root').observable.skip(1).subscribe(function (root) {
      let selectEl = root.querySelector('.target');
      //console.log(selectEl.textContent)
      assert.notStrictEqual(selectEl, null);
      assert.notStrictEqual(typeof selectEl, 'undefined');
      assert.strictEqual(selectEl.tagName, 'H3');
      assert.notStrictEqual(selectEl.textContent, '10');
      if (selectEl.textContent === '9') {
        responses.dispose();
        requests.dispose();
        setTimeout(() => {
          done();
        }, 100);
      }
    });
  });

  it('should allow nested svg elements as children', function (done) {
    // Make the svg nested dialogue
    function workspace(sources) {
      const children$ = sources.children$ || Rx.Observable.of(void 0);
      return {
        DOM: sources.props$.combineLatest(
          children$,
          (props, children) => {
            console.log(children)
            const svgProps = {...props, children: void 0};
            return svg('svg', {
                attributes: svgProps,
                style: {border: '1px solid rgb(221, 221, 221)'}
              },
              children
            );
          }
        )
      }
    }
    // Use the nested dialogue
    function app() {
      return {
        DOM: Rx.Observable.of(
          h('section', workspace({
            props$: Rx.Observable.of({width: 500, height: 500}),
            children$: workspace({
              props$: Rx.Observable.of({
                width: 100, height: 100
              })
            }).DOM
          }).DOM)
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: makeDOMDriver(createRenderTarget())
    });
    // Make assertions
    responses.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
      let svgElements = root.querySelectorAll('svg');
      assert.strictEqual(svgElements.length, 2);
      responses.dispose();
      done();
    });
  })
});

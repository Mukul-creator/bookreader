//@ts-check
const BookReader = /** @type {typeof import('../BookReader').default} */(window.BookReader);

class TextSelectionPlugin {

  constructor() {
    /**@type {PromiseLike<JQuery<HTMLElement>>} */
    this.djvuPagesPromise = null;
  }

  /**
   * @param {string} ocaid
   */
  init(ocaid) {
    this.djvuPagesPromise = $.ajax({
      type: "GET",
      url: `https://cors.archive.org/cors/${ocaid}/${ocaid}_djvu.xml`,
      dataType: "xml",

      error: function (e) {
        return undefined;
      }
    }).then(function (response) {
      const xmlMap = response;

      if (xmlMap != undefined) {
        return $(xmlMap).find("OBJECT");
      }
    });
  }

  /**
   * @param {number} index
   * @returns {Promise<HTMLElement>}
   */
  async getPageText(index) {
    return (await this.djvuPagesPromise)[index];
  }

  /**
   * @param {JQuery} $container
   */
  stopPageFlip($container){
    const $svg = $container.find('svg');
    $svg.on("mousedown", (event) => {
      if ($(event.target).is('tspan')) {
        event.stopPropagation();
        $container.one("mouseup", (event) => event.stopPropagation());
      }
    });
  }

  /**
   * @param {number} pageIndex
   * @param {JQuery} $container
   */
  async createTextLayer(pageIndex, $container) {
    const $svgLayers = $container.find('textSelctionSVG');
    if (!$svgLayers.length) {
      const XMLpage = await this.getPageText(pageIndex);
      const XMLwidth = $(XMLpage).attr("width");
      const XMLheight = $(XMLpage).attr("height");

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 " + XMLwidth + " " + XMLheight);
      $container.append(svg);
      $(svg).addClass('textSelctionSVG');
      svg.setAttribute('preserveAspectRatio', 'none');
      $(svg).css({
        "width": "100%",
        "position": "absolute",
        "height": "100%",
        "top": "0",
        "left": "0",
      });

      $(XMLpage).find("LINE").each((i, line) => {
        // adding text element for each line in the page
        const lineSvg = document.createElementNS("http://www.w3.org/2000/svg", "text");
        const lineArr = $(line).find("WORD");
        let [leftMin, bottomMax, rightMax, topMin] = [Infinity, 0, 0, Infinity];

        for(i = 0; i < lineArr.length; i++) {
          // adding tspan for each word in line
          const currWord = lineArr[i];
          // eslint-disable-next-line no-unused-vars
          const [left, bottom, right, top] = $(currWord).attr("coords").split(',').map(parseFloat);
          if(left < leftMin) leftMin = left;
          if(bottom > bottomMax) bottomMax = bottom;
          if(right > rightMax) rightMax = right;
          if(top < topMin) topMin = top;
          const wordTspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
          wordTspan.setAttribute("x", left.toString());
          wordTspan.setAttribute("textLength", (right - left).toString());
          const textNode = document.createTextNode(currWord.textContent);
          wordTspan.append(textNode);
          lineSvg.append(wordTspan);

          // adding spaces after words not at the end of the line
          if(i < lineArr.length - 1){
            const nextWord = lineArr[i + 1];
            // eslint-disable-next-line no-unused-vars
            const [leftNext, bottomNext, rightNext, topNext] = $(nextWord).attr("coords").split(',').map(parseFloat);
            const spaceTspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            spaceTspan.setAttribute("x", right.toString());
            spaceTspan.setAttribute("textLength", (leftNext - right).toString());        
            const spaceTextNode = document.createTextNode(" ");
            spaceTspan.append(spaceTextNode);
            lineSvg.append(spaceTspan);
          }
        }
        lineSvg.setAttribute("x", leftMin.toString());
        lineSvg.setAttribute("y", bottomMax.toString());
        lineSvg.setAttribute("font-size", (bottomMax - topMin).toString());
        lineSvg.setAttribute("textLength", (rightMax - leftMin).toString());
        $(lineSvg).css({
          "fill": "red",
          "cursor": "text",
          'white-space': 'pre',
          "dominant-baseline": "text-after-edge",
          // "fill-opacity": "0",
        });
        svg.append(lineSvg);
      })
      this.stopPageFlip($container);
    }
  }
}

class BookreaderWithTextSelection extends BookReader {
  init() {
    if(this.enableTextSelection){
      this.enableTextSelection = true;
      const OCAID = this.bookId;
      this.textSelectionPlugin = new TextSelectionPlugin();
      this.textSelectionPlugin.init(OCAID);
    }
    super.init();
  }

  /**
   * @param {PageModel} page
   */
  _createPageContainer(page, styles = {}) {
    const $container = super._createPageContainer(page, styles);
    if(this.enableTextSelection){
      this.textSelectionPlugin.createTextLayer(page.index, $container);
    }
    return $container;
  }
}
window.BookReader = BookreaderWithTextSelection;
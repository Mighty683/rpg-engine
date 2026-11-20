/** True when the scroll position is within the load-ahead threshold of the list bottom. */
export function nearBottom(el: HTMLElement, threshold = 400) {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
}

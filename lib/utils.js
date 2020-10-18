'use strict'

const has = Object.prototype.hasOwnProperty
const isArray = Array.isArray
const hexTable = ( () => {
  let array = []
  for (let i = 0; i < 256; ++i) {
    array.push('%' + ((i < 16 ? '0' : '') + i.toString(16)).toUpperCase())
  }
  return array
})()

const compactQueue = (queue) => {
  while (queue.length > 1) {
    let item = queue.pop()
    let obj = item.obj[item.prop]
    if (isArray(obj)) {
      let compacted = []
      for (let j = 0; j < obj.length; ++j) {
        if (typeof obj[j] !== 'undefined') {
          compacted.push(obj[j])
        }
      }
      item.obj[item.prop] = compacted
    }
  }
}

const arrayToObject = (source, options) => {
  let obj = options && options.plainObjects ? Object.create(null) : {}
  for (let i = 0; i < source.length; ++i) {
    if (typeof source[i] !== 'undefined') {
      obj[i] = source[i]
    }
  }
  return obj
}

const merge = (target, source, options) => {
  /* eslint no-param-reassign: 0 */
  if (!source) {
    return target
  }
  if (typeof source !== 'object') {
    if (isArray(target)) {
      target.push(source)
    } else if (target && typeof target === 'object') {
      if ((options && (options.plainObjects || options.allowPrototypes)) || !has.call(Object.prototype, source)) {
        target[source] = true
      }
    } else {
      return [target, source]
    }
    return target
  }
  if (!target || typeof target !== 'object') {
    return [target].concat(source)
  }
  let mergeTarget = target
  if (isArray(target) && !isArray(source)) {
    mergeTarget = arrayToObject(target, options)
  }
  if (isArray(target) && isArray(source)) {
    source.forEach(function (item, i) {
      if (has.call(target, i)) {
        let targetItem = target[i]
        if (targetItem && typeof targetItem === 'object' && item && typeof item === 'object') {
          target[i] = merge(targetItem, item, options)
        } else {
          target.push(item)
        }
      } else {
        target[i] = item
      }
    })
    return target
  }

  return Object.keys(source).reduce(function (acc, key) {
    let value = source[key]
    if (has.call(acc, key)) {
      acc[key] = merge(acc[key], value, options)
    } else {
      acc[key] = value
    }
    return acc
  }, mergeTarget)
}

const assign = (target, source) => {
  return Object.keys(source).reduce(function (acc, key) {
    acc[key] = source[key]
    return acc
  }, target)
}

const decode = (str, decoder, charset) => {
  let strWithoutPlus = str.replace(/\+/g, ' ')
  if (charset === 'iso-8859-1') {
    // unescape never throws, no try...catch needed:
    return strWithoutPlus.replace(/%[0-9a-f]{2}/gi, unescape)
  }
  // utf-8
  try {
    return decodeURIComponent(strWithoutPlus)
  } catch (e) {
    return strWithoutPlus
  }
}

const encode = (str, defaultEncoder, charset) => {
  if (str.length === 0) {
    return str
  }
  let string = str
  if (typeof str === 'symbol') {
    string = Symbol.prototype.toString.call(str)
  } else if (typeof str !== 'string') {
    string = String(str)
  }
  if (charset === 'iso-8859-1') {
    return escape(string).replace(/%u[0-9a-f]{4}/gi, function ($0) {
      return '%26%23' + parseInt($0.slice(2), 16) + '%3B'
    })
  }
  let out = ''
  for (let i = 0; i < string.length; ++i) {
    let c = string.charCodeAt(i)
    if (
      c === 0x2D // -
      || c === 0x2E // .
      || c === 0x5F // _
      || c === 0x7E // ~
      || (c >= 0x30 && c <= 0x39) // 0-9
      || (c >= 0x41 && c <= 0x5A) // a-z
      || (c >= 0x61 && c <= 0x7A) // A-Z
    ) {
      out += string.charAt(i)
      continue
    }
    if (c < 0x80) {
      out = out + hexTable[c]
      continue
    }
    if (c < 0x800) {
      out = out + (hexTable[0xC0 | (c >> 6)] + hexTable[0x80 | (c & 0x3F)])
      continue
    }
    if (c < 0xD800 || c >= 0xE000) {
      out = out + (hexTable[0xE0 | (c >> 12)] + hexTable[0x80 | ((c >> 6) & 0x3F)] + hexTable[0x80 | (c & 0x3F)])
      continue
    }
    i++
    c = 0x10000 + (((c & 0x3FF) << 10) | (string.charCodeAt(i) & 0x3FF))
    out += hexTable[0xF0 | (c >> 18)]
      + hexTable[0x80 | ((c >> 12) & 0x3F)]
      + hexTable[0x80 | ((c >> 6) & 0x3F)]
      + hexTable[0x80 | (c & 0x3F)]
  }
  return out
}

const compact = (value) => {
  let queue = [{ obj: { o: value }, prop: 'o' }]
  let refs = []
  for (let i = 0; i < queue.length; ++i) {
    let item = queue[i]
    let obj = item.obj[item.prop]
    let keys = Object.keys(obj)
    for (let j = 0; j < keys.length; ++j) {
      let key = keys[j]
      let val = obj[key]
      if (typeof val === 'object' && val !== null && refs.indexOf(val) === -1) {
        queue.push({ obj: obj, prop: key })
        refs.push(val)
      }
    }
  }
  compactQueue(queue)
  return value
}

const isRegExp = (obj) => {
  return Object.prototype.toString.call(obj) === '[object RegExp]'
}

const isBuffer = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return false
  }
  return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj))
}

const combine = (a, b) => {
  return [].concat(a, b)
}

const maybeMap = (val, fn) => {
  if (isArray(val)) {
    let mapped = []
    for (let i = 0; i < val.length; i++) {
      mapped.push(fn(val[i]))
    }
    return mapped
  }
  return fn(val)
}

module.exports = {
  arrayToObject: arrayToObject,
  assign: assign,
  combine: combine,
  compact: compact,
  decode: decode,
  encode: encode,
  isBuffer: isBuffer,
  isRegExp: isRegExp,
  maybeMap: maybeMap,
  merge: merge
}

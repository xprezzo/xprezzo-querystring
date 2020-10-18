'use strict'

const utils = require('./utils')
const formats = require('./formats')
const has = Object.prototype.hasOwnProperty

const arrayPrefixGenerators = {
  brackets: (prefix) => {
    return prefix + '[]'
  },
  comma: 'comma',
  indices: (prefix, key) => {
    return prefix + '[' + key + ']'
  },
  repeat: (prefix) => {
    return prefix
  }
}

const isArray = Array.isArray
const push = Array.prototype.push
const pushToArray = (arr, valueOrArray) => {
    push.apply(arr, isArray(valueOrArray) ? valueOrArray : [valueOrArray])
}

const toISO = Date.prototype.toISOString

const defaultFormat = formats['default']
const defaults = {
    addQueryPrefix: false,
    allowDots: false,
    charset: 'utf-8',
    charsetSentinel: false,
    delimiter: '&',
    encode: true,
    encoder: utils.encode,
    encodeValuesOnly: false,
    format: defaultFormat,
    formatter: formats.formatters[defaultFormat],
    // deprecated
    indices: false,
    serializeDate: function serializeDate(date) {
        return toISO.call(date)
    },
    skipNulls: false,
    strictNullHandling: false
}

const isNonNullishPrimitive = (v) => {
    return typeof v === 'string'
        || typeof v === 'number'
        || typeof v === 'boolean'
        || typeof v === 'symbol'
        || typeof v === 'bigint'
}

const stringify = (
  object,
  prefix,
  generateArrayPrefix,
  strictNullHandling,
  skipNulls,
  encoder,
  filter,
  sort,
  allowDots,
  serializeDate,
  formatter,
  encodeValuesOnly,
  charset
) => {
  let obj = object
  if (typeof filter === 'function') {
    obj = filter(prefix, obj)
  } else if (obj instanceof Date) {
    obj = serializeDate(obj)
  } else if (generateArrayPrefix === 'comma' && isArray(obj)) {
    obj = utils.maybeMap(obj, function (value) {
      if (value instanceof Date) {
        return serializeDate(value)
      }
      return value
    })
  }
  if (obj === null) {
    if (strictNullHandling) {
      return encoder && !encodeValuesOnly ? encoder(prefix, defaults.encoder, charset, 'key') : prefix
    }
    obj = ''
  }
  if (isNonNullishPrimitive(obj) || utils.isBuffer(obj)) {
    if (encoder) {
      let keyValue = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder, charset, 'key')
      return [formatter(keyValue) + '=' + formatter(encoder(obj, defaults.encoder, charset, 'value'))]
    }
    return [formatter(prefix) + '=' + formatter(String(obj))]
  }
  let values = []
  if (typeof obj === 'undefined') {
    return values
  }
  let objKeys
  if (generateArrayPrefix === 'comma' && isArray(obj)) {
    // we need to join elements in
    objKeys = [{ value: obj.length > 0 ? obj.join(',') || null : undefined }]
  } else if (isArray(filter)) {
    objKeys = filter
  } else {
    let keys = Object.keys(obj)
    objKeys = sort ? keys.sort(sort) : keys
  }
  for (let i = 0; i < objKeys.length; ++i) {
    let key = objKeys[i]
    let value = typeof key === 'object' && key.value !== undefined ? key.value : obj[key]
    if (skipNulls && value === null) {
      continue
    }
    let keyPrefix = isArray(obj)
      ? typeof generateArrayPrefix === 'function' ? generateArrayPrefix(prefix, key) : prefix
      : prefix + (allowDots ? '.' + key : '[' + key + ']')
    pushToArray(values, stringify(
      value,
      keyPrefix,
      generateArrayPrefix,
      strictNullHandling,
      skipNulls,
      encoder,
      filter,
      sort,
      allowDots,
      serializeDate,
      formatter,
      encodeValuesOnly,
      charset
    ))
  }
  return values
}

const normalizeStringifyOptions = (opts) => {
  if (!opts) {
    return defaults
  }
  if (opts.encoder !== null && opts.encoder !== undefined && typeof opts.encoder !== 'function') {
    throw new TypeError('Encoder has to be a function.')
  }
  let charset = opts.charset || defaults.charset
  if (typeof opts.charset !== 'undefined' && opts.charset !== 'utf-8' && opts.charset !== 'iso-8859-1') {
    throw new TypeError('The charset option must be either utf-8, iso-8859-1, or undefined')
  }
  let format = formats['default']
  if (typeof opts.format !== 'undefined') {
    if (!has.call(formats.formatters, opts.format)) {
      throw new TypeError('Unknown format option provided.')
    }
    format = opts.format
  }
  let formatter = formats.formatters[format]
  let filter = defaults.filter
  if (typeof opts.filter === 'function' || isArray(opts.filter)) {
    filter = opts.filter
  }
  return {
    addQueryPrefix: typeof opts.addQueryPrefix === 'boolean' ? opts.addQueryPrefix : defaults.addQueryPrefix,
    allowDots: typeof opts.allowDots === 'undefined' ? defaults.allowDots : !!opts.allowDots,
    charset: charset,
    charsetSentinel: typeof opts.charsetSentinel === 'boolean' ? opts.charsetSentinel : defaults.charsetSentinel,
    delimiter: typeof opts.delimiter === 'undefined' ? defaults.delimiter : opts.delimiter,
    encode: typeof opts.encode === 'boolean' ? opts.encode : defaults.encode,
    encoder: typeof opts.encoder === 'function' ? opts.encoder : defaults.encoder,
    encodeValuesOnly: typeof opts.encodeValuesOnly === 'boolean' ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
    filter: filter,
    formatter: formatter,
    serializeDate: typeof opts.serializeDate === 'function' ? opts.serializeDate : defaults.serializeDate,
    skipNulls: typeof opts.skipNulls === 'boolean' ? opts.skipNulls : defaults.skipNulls,
    sort: typeof opts.sort === 'function' ? opts.sort : null,
    strictNullHandling: typeof opts.strictNullHandling === 'boolean' ? opts.strictNullHandling : defaults.strictNullHandling
  }
}

module.exports = (object, opts) => {
  let obj = object
  let options = normalizeStringifyOptions(opts)
  let objKeys
  let filter
  if (typeof options.filter === 'function') {
    filter = options.filter
    obj = filter('', obj)
  } else if (isArray(options.filter)) {
    filter = options.filter
    objKeys = filter
  }
  let keys = []
  if (typeof obj !== 'object' || obj === null) {
    return ''
  }
  let arrayFormat
  if (opts && opts.arrayFormat in arrayPrefixGenerators) {
    arrayFormat = opts.arrayFormat
  } else if (opts && 'indices' in opts) {
    arrayFormat = opts.indices ? 'indices' : 'repeat'
  } else {
    arrayFormat = 'indices'
  }
  let generateArrayPrefix = arrayPrefixGenerators[arrayFormat]
  if (!objKeys) {
    objKeys = Object.keys(obj)
  }
  if (options.sort) {
    objKeys.sort(options.sort)
  }
  for (let i = 0; i < objKeys.length; ++i) {
    let key = objKeys[i]
    if (options.skipNulls && obj[key] === null) {
      continue
    }
    pushToArray(keys, stringify(
      obj[key],
      key,
      generateArrayPrefix,
      options.strictNullHandling,
      options.skipNulls,
      options.encode ? options.encoder : null,
      options.filter,
      options.sort,
      options.allowDots,
      options.serializeDate,
      options.formatter,
      options.encodeValuesOnly,
      options.charset
    ))
  }
  let joined = keys.join(options.delimiter)
  let prefix = options.addQueryPrefix === true ? '?' : ''
  if (options.charsetSentinel) {
    if (options.charset === 'iso-8859-1') {
      // encodeURIComponent('&#10003;'), the "numeric entity" representation of a checkmark
      prefix += 'utf8=%26%2310003%3B&'
    } else {
      // encodeURIComponent('✓')
      prefix += 'utf8=%E2%9C%93&'
    }
  }
  return joined.length > 0 ? prefix + joined : ''
}

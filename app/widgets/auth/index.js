'use strict';

var Ractive = require('hive-ractive')
var Hive = require('hive-wallet')
var emitter = require('hive-emitter')
var router = require('hive-router').router
var hasher = require('hive-router').hasher
var $ = require('browserify-zepto')
var fastclick = require('fastclick')
var arrival = require('arrival')

var timerId = null

function register(el){
  var ractive = new Ractive({
    el: el,
    data: {
      opening: false,
      newUser: true,
      enterPin: false,
      createWallet: false,
      passphrase_array: [],
      create_intro: true,
      create_read: false,
      create_confirm: false,
      create_pin: false,
      passphrase_pending: true,
      passphrase_animating: false,
      pass_next_text: 'Next word'
    },
    template: require('./auth_register.ract').template
  })

  includeSharedBehaviors(ractive)

  ractive.on('prepare-seed', function(event){
    event.original.preventDefault()
    ractive.set('createWallet', true)
  })

  ractive.on('temp-back', function(event){
    event.original.preventDefault()
    ractive.set('createWallet', false)
  })

  ractive.on('generate-phrase', function(event){
    event.original.preventDefault()
    ractive.set('create_intro', false)
    ractive.set('create_read', true)
    Hive.createWallet(null, ractive.getNetwork(), onSeedCreated)
  })

  function onSeedCreated() {
    var wallet = Hive.getWallet()
    var string = wallet.getMnemonic()
    var array = string.split(' ')
    ractive.set('passphrase', string)
    ractive.set('passphrase_length', array.length)
    ractive.set('current_word', 0)
    ractive.set('passphrase_pending', false)
    ractive.set('passphrase_array', array)

    var current_element = $(ractive.nodes['seed_word_' + 0])
    current_element.addClass('middle')

    $(ractive.findAll('.attach_fastclick')).each(function(){
      fastclick(this);
    });
  }

  ractive.on('next-word', function(event) {

    event.original.preventDefault()
    var old_word = ractive.get('current_word')
    var length = ractive.get('passphrase_array').length
    var is_animating = ractive.get('passphrase_animating')

    if(is_animating){ return; }
    if(old_word === length - 1) {
      ractive.set('create_read', false)
      ractive.set('create_confirm', true)
      return;
    }
    if(old_word === length - 2) {
      ractive.set('pass_next_text', 'Review Passphrase')
    }

    ractive.set('passphrase_animating', true)

    var new_word = old_word + 1;
    var old_element = $(ractive.nodes['seed_word_' + old_word])
    var new_element = $(ractive.nodes['seed_word_' + new_word])

    ractive.set('current_word', new_word)
    old_element.addClass('left')
    new_element.addClass('middle')

    // arrival(ractive.nodes.pass_words, animation_complete)
    setTimeout(animation_complete, 400)
  })

  ractive.on('prev-word', function(event) {

    event.original.preventDefault()
    var old_word = ractive.get('current_word')
    var length = ractive.get('passphrase_array').length
    var is_animating = ractive.get('passphrase_animating')

    if(old_word === 0 || is_animating){ return; }
    if(old_word === length - 1) {
      ractive.set('pass_next_text', 'Next word')
    }

    ractive.set('passphrase_animating', true)

    var new_word = old_word - 1;
    var old_element = $(ractive.nodes['seed_word_' + old_word])
    var new_element = $(ractive.nodes['seed_word_' + new_word])

    ractive.set('current_word', new_word)
    old_element.removeClass('middle')
    new_element.removeClass('left')

    // arrival(ractive.nodes.pass_words, animation_complete)
    setTimeout(animation_complete, 400)
  })

  function animation_complete() {
    ractive.set('passphrase_animating', false)
  }

  ractive.on('create-pin', function(event) {
    event.original.preventDefault()
    ractive.set('create_confirm', false)
    ractive.set('create_pin', true)
  })








  ractive.on('open-wallet-with-passphrase', function(event){
    event.original.preventDefault()
    Hive.createWallet(getPassphrase(), ractive.getNetwork(), onWalletCreated)
  })

  ractive.on('reveal-passphrase-input', function(event){
    event.original.preventDefault()
    ractive.set('newUser', false);
    ractive.nodes.passphraseField.focus();
  })

  ractive.on('hide-passphrase-input', function(event){
    event.original.preventDefault()
    ractive.set('newUser', true);
  })

  ractive.on('create-wallet', function(event){
    event.original.preventDefault()
    Hive.createWallet(null, ractive.getNetwork(), onWalletCreated)
  })

  ractive.on('set-pin', function(event){
    Hive.setPin(ractive.get('pin'), ractive.onSyncDone)
    ractive.set('progress', 'Saving pin...')
  })

  function getPassphrase(){
    return ractive.get('passphrase').trim()
  }

  return ractive
}

function login(el){
  var ractive = new Ractive({
    el: el,
    data: {
      opening: false
    },
    template: require('./auth_login.ract').template
  })

  includeSharedBehaviors(ractive)

  ractive.on('open-wallet-with-pin', function(event){
    event.original.preventDefault()
    ractive.set('opening', true)
    ractive.set('progress', 'Checking PIN...')
    Hive.openWalletWithPin(getPin(), ractive.getNetwork(), ractive.onSyncDone)
  })

  ractive.on('clear-credentials', function(event){
    event.original.preventDefault()
    Hive.reset(function(err){
      location.reload(false);
    })
  })

  function getPin(){
    return ractive.get('pin')
  }

  return ractive
}


function includeSharedBehaviors(ractive) {
  emitter.on('wallet-opening', function(progress){
    ractive.set('progress', progress)
    loading()
  })

  function onSyncDone(err, transactions) {
    ractive.set('opening', false)
    if(err) {
      if(err === 'user_deleted') return location.reload(false);
      return alert("error synchronizing. " + err)
    }

    hasher.setHash('#home');
    emitter.emit('wallet-ready')
    emitter.emit('transactions-loaded', transactions)
  }

  function getNetwork() {
    if(location.search.indexOf('testnet=true') > 0) {
      return 'testnet'
    }
  }

  function loading() {
    timerId = setInterval(function(){
      var text = ractive.get('progress')
      ractive.set('progress', text + '.')
    }, 500)
  }

  function pauseLoading() {
    clearInterval(timerId)
    timerId = null
  }

  ractive.onSyncDone = onSyncDone
  ractive.getNetwork = getNetwork
  ractive.loading = loading
  ractive.pauseLoading = pauseLoading
}

module.exports = {
  login: login,
  register: register
}

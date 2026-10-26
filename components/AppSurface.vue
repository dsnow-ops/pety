<template><view :class="['ui-surface','ui-surface--'+variant]"><slot/></view></template>
<script>export default{props:{variant:{type:String,default:'group'}}};</script>

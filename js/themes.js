// Colour themes. Rule for every theme: roofs must be DARK and the ground/background LIGHT,
// otherwise the QR seen from the magic view is not scannable.
// `sky` = top of the background gradient, `roofs` = optional mix of dark roof colours.
export const THEMES = {
  allegro: {
    sky: '#d9edfa', bg: '#fbf3e6', ground: '#fffdf8', groundSide: '#9cc98a',
    roof: '#3b3157', roofs: ['#3b3157', '#57283a', '#24405a', '#2c4632'],
    walls: ['#f2a898', '#f3cf8a', '#a6d6c6', '#b0cbe6', '#efbdd0', '#cdbfe6', '#f4e7cf'],
  },
  milano: {
    sky: '#f6efe4', bg: '#ece5da', ground: '#f8f4ed', groundSide: '#c7b49b', roof: '#47281f',
    walls: ['#d98c5f', '#e9b97c', '#c4654a', '#efd9b0', '#b7795c', '#e2a37f'],
  },
  lago: {
    sky: '#d6ecf7', bg: '#eef4f6', ground: '#f5f9fa', groundSide: '#97b0be', roof: '#1b3044',
    walls: ['#7fb3d5', '#a9cce3', '#f3efe2', '#5e8aa8', '#d4e3ea', '#9ec5b8'],
  },
  pastello: {
    sky: '#fde7f0', bg: '#eef0fb', ground: '#fcf9fd', groundSide: '#c6b3d4', roof: '#36234d',
    walls: ['#f6c1d0', '#b8e0d2', '#f9e2ae', '#c3b1e1', '#a7c7e7', '#ffd3b6'],
  },
  tramonto: {
    sky: '#ffd9c2', bg: '#fff1e0', ground: '#fff6ee', groundSide: '#dea283', roof: '#481b2d',
    walls: ['#f28c6b', '#f6b26b', '#e06a7a', '#ffd6a5', '#c8577a', '#f9c784'],
  },
  inchiostro: {
    bg: '#f4f4f4', ground: '#ffffff', groundSide: '#bdbdbd', roof: '#111111',
    walls: ['#e6e6e6', '#cfcfcf', '#f5f5f5', '#bcbcbc', '#dadada'],
  },
};

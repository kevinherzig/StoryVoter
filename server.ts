import * as serveStatic from 'serve-static';
import * as http from 'http';
import * as express from 'express'

serveStatic(',', undefined)


express.static(__dirname, {port: 3000})

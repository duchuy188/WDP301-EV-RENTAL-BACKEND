const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');


dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);


const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';


const timezoneUtils = {

  toVietnamTime: (utcDate) => {
    if (!utcDate) return null;
    return dayjs(utcDate).tz(VIETNAM_TIMEZONE);
  },


  toUTC: (vietnamDate) => {
    if (!vietnamDate) return null;
    return dayjs.tz(vietnamDate, VIETNAM_TIMEZONE).utc();
  },

  
  formatVietnamTime: (utcDate, format = 'DD/MM/YYYY HH:mm:ss') => {
    if (!utcDate) return null;
    return dayjs(utcDate).tz(VIETNAM_TIMEZONE).format(format);
  },

 
  nowVietnam: () => {
    return dayjs().tz(VIETNAM_TIMEZONE);
  },


  nowUTC: () => {
    return dayjs().utc();
  },

 
  parseVietnamTime: (dateString, format = 'DD/MM/YYYY HH:mm:ss') => {
    if (!dateString) return null;
    return dayjs.tz(dateString, format, VIETNAM_TIMEZONE);
  },


  isVietnamTime: (date) => {
    if (!date) return false;
    return dayjs(date).tz() === VIETNAM_TIMEZONE;
  }
};

module.exports = {
  dayjs,
  VIETNAM_TIMEZONE,
  ...timezoneUtils
};

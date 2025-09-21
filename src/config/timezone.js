const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');

// Load plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

// Set timezone mặc định cho Việt Nam
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

// Helper functions
const timezoneUtils = {
  // Chuyển từ UTC sang giờ Việt Nam
  toVietnamTime: (utcDate) => {
    if (!utcDate) return null;
    return dayjs(utcDate).tz(VIETNAM_TIMEZONE);
  },

  // Chuyển từ giờ Việt Nam sang UTC
  toUTC: (vietnamDate) => {
    if (!vietnamDate) return null;
    return dayjs.tz(vietnamDate, VIETNAM_TIMEZONE).utc();
  },

  // Format date theo giờ Việt Nam
  formatVietnamTime: (utcDate, format = 'DD/MM/YYYY HH:mm:ss') => {
    if (!utcDate) return null;
    return dayjs(utcDate).tz(VIETNAM_TIMEZONE).format(format);
  },

  // Lấy thời gian hiện tại theo giờ Việt Nam
  nowVietnam: () => {
    return dayjs().tz(VIETNAM_TIMEZONE);
  },

  // Lấy thời gian hiện tại theo UTC
  nowUTC: () => {
    return dayjs().utc();
  },

  // Parse date string theo timezone Việt Nam
  parseVietnamTime: (dateString, format = 'DD/MM/YYYY HH:mm:ss') => {
    if (!dateString) return null;
    return dayjs.tz(dateString, format, VIETNAM_TIMEZONE);
  },

  // Kiểm tra xem có phải giờ Việt Nam không
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

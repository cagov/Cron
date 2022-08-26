
const nowPacTime = (/** @type {Intl.DateTimeFormatOptions} */ options) => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});

const cron_holidays = [
            '2022-02-21', // presidents day
            '2022-03-31', // cesar chavez day
            '2022-05-30', // memorial day
            '2022-05-31', // Tuesday after memorial day
            '2022-07-04', // independence day
            '2022-07-05', // Tuesday after independence day
            '2022-09-05', // labor day
            '2022-11-11', // veterens day
            '2022-11-24', // thanksgiving
            '2022-11-25', // day after thanksgiving
            '2022-12-25', // christmas
            ]


const isIdleDay = ({weekends_off = true, holidays_off = true, first_week_only = false}) => {
    const todayDateStr = todayDateString();
    const dayOfWeekIdx = (new Date()).getDay(); // sunday is zero
    const dayOfMonth = (new Date()).getDate(); // 1-31
    if (holidays_off && cron_holidays.includes(todayDateStr)) {
        return true;
    }
    if (weekends_off && (dayOfWeekIdx == 0 || dayOfWeekIdx == 6)) {
        return true;
    }
    if (first_week_only && (dayOfMonth > 7)) {
        return true;
    }
    return false;
};


module.exports = {
    isIdleDay
};

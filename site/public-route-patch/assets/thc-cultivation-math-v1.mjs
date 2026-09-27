const finite=(value,label)=>{const n=Number(value);if(!Number.isFinite(n))throw new RangeError(`${label} must be a finite number`);return n};
const nonnegative=(value,label)=>{const n=finite(value,label);if(n<0)throw new RangeError(`${label} must be non-negative`);return n};
const positive=(value,label)=>{const n=finite(value,label);if(n<=0)throw new RangeError(`${label} must be greater than zero`);return n};
const humidity=(value)=>{const n=finite(value,'Relative humidity');if(n<=0||n>100)throw new RangeError('Relative humidity must be greater than 0 and no more than 100');return n};

export function dliFromPpfd(ppfd,photoperiodHours){return nonnegative(ppfd,'PPFD')*nonnegative(photoperiodHours,'Photoperiod')*0.0036}
export function ppfdFromDli(dli,photoperiodHours){return nonnegative(dli,'DLI')/(positive(photoperiodHours,'Photoperiod')*0.0036)}
export function integrateDli(segments){if(!Array.isArray(segments)||!segments.length)throw new RangeError('Light segments are required');return segments.reduce((sum,segment)=>sum+dliFromPpfd(segment.ppfd,segment.hours),0)}

export function saturationVaporPressure(tempC){const t=finite(tempC,'Temperature');return 0.6108*Math.exp((17.27*t)/(t+237.3))}
export function airVpd(airTempC,relativeHumidity){const rh=humidity(relativeHumidity);return saturationVaporPressure(airTempC)*(1-rh/100)}
export function leafVpd(airTempC,relativeHumidity,leafTempC){const rh=humidity(relativeHumidity);return saturationVaporPressure(leafTempC)-saturationVaporPressure(airTempC)*(rh/100)}

export function dilutionStockVolume(stockConcentration,targetConcentration,finalVolume){const c1=positive(stockConcentration,'Stock concentration');const c2=nonnegative(targetConcentration,'Target concentration');const v2=positive(finalVolume,'Final volume');if(c2>c1)throw new RangeError('Target concentration cannot exceed stock concentration');return c2*v2/c1}
export function serialDilution({initialConcentration,targetConcentration,stepFactor=10,finalVolume}){let current=positive(initialConcentration,'Initial concentration');const target=positive(targetConcentration,'Target concentration');const factor=positive(stepFactor,'Step factor');const volume=positive(finalVolume,'Final volume');if(factor<=1)throw new RangeError('Step factor must be greater than one');if(target>current)throw new RangeError('Target concentration cannot exceed initial concentration');const steps=[];let guard=0;while(current>target&&(guard++<100)){const next=Math.max(target,current/factor);const stockVolume=dilutionStockVolume(current,next,volume);steps.push({from:current,to:next,stockVolume,diluentVolume:volume-stockVolume,finalVolume:volume});current=next}return steps}

export function dewPoint(tempC,relativeHumidity){const t=finite(tempC,'Temperature');const rh=humidity(relativeHumidity);const a=17.625,b=243.04,g=Math.log(rh/100)+(a*t)/(b+t);return b*g/(a-g)}
export function airChangesPerHour(deliveredCfm,roomVolumeCubicFeet){return nonnegative(deliveredCfm,'Delivered airflow')*60/positive(roomVolumeCubicFeet,'Room volume')}

export function gallonsToLiters(gallons){return nonnegative(gallons,'Gallons')*3.785411784}
export function litersToGallons(liters){return nonnegative(liters,'Liters')/3.785411784}
export function celsiusToFahrenheit(celsius){return finite(celsius,'Celsius')*9/5+32}
export function fahrenheitToCelsius(fahrenheit){return (finite(fahrenheit,'Fahrenheit')-32)*5/9}
export function centimetersToInches(centimeters){return nonnegative(centimeters,'Centimeters')/2.54}
export function inchesToCentimeters(inches){return nonnegative(inches,'Inches')*2.54}
export function squareMetersToSquareFeet(squareMeters){return nonnegative(squareMeters,'Square meters')*10.7639104167}
export function squareFeetToSquareMeters(squareFeet){return nonnegative(squareFeet,'Square feet')/10.7639104167}
export function gramsToOunces(grams){return nonnegative(grams,'Grams')/28.349523125}
export function ouncesToGrams(ounces){return nonnegative(ounces,'Ounces')*28.349523125}
export function millisiemensToMicrosiemens(ms){return nonnegative(ms,'mS/cm')*1000}
export function microsiemensToMillisiemens(us){return nonnegative(us,'µS/cm')/1000}
export function cfmToCubicMetersPerHour(cfm){return nonnegative(cfm,'CFM')*1.69901082}
export function cubicMetersPerHourToCfm(m3h){return nonnegative(m3h,'m³/h')/1.69901082}
export function ecToDisplayedPpm(ecMsCm,scale){const ec=nonnegative(ecMsCm,'EC');const s=finite(scale,'PPM scale');if(s!==500&&s!==700)throw new RangeError('PPM scale must be 500 or 700');return ec*s}
export function displayedPpmToEc(ppm,scale){const value=nonnegative(ppm,'Displayed ppm');const s=finite(scale,'PPM scale');if(s!==500&&s!==700)throw new RangeError('PPM scale must be 500 or 700');return value/s}
export function drybackPercent(highReference,lowReference,current){const high=finite(highReference,'High reference');const low=finite(lowReference,'Low reference');const now=finite(current,'Current reading');const span=high-low;if(span<=0)throw new RangeError('High reference must be greater than low reference');return (high-now)/span*100}
export function ratePerHour(change,hours){return finite(change,'Change')/positive(hours,'Hours')}
export function fertilizerMassGrams(targetMgL,finalLiters,nutrientPercent){const target=nonnegative(targetMgL,'Target concentration');const liters=positive(finalLiters,'Final liters');const pct=positive(nutrientPercent,'Nutrient percent');if(pct>100)throw new RangeError('Nutrient percent cannot exceed 100');return target*liters/(1000*(pct/100))}
export function p2o5PercentToElementalP(percent){return nonnegative(percent,'P₂O₅ percent')*0.4364}
export function k2oPercentToElementalK(percent){return nonnegative(percent,'K₂O percent')*0.8301}

/**
 * Copyright (c) 2017 NAVER Corp.
 * billboard.js project is licensed under the MIT license
 */
import {
	select as d3Select
} from "d3";

import ChartInternal from "../internals/ChartInternal";
import {isFunction, isObjectType, extend, notEmpty} from "../internals/util";

extend(ChartInternal.prototype, {
	hasValidPointType(type) {
		return /^(circle|rect(angle)?|polygon|ellipse)$/i.test(type || this.config.point_type);
	},

	hasValidPointDrawMethods(type) {
		const pointType = type || this.config.point_type;

		return isObjectType(pointType) &&
			isFunction(pointType.create) && isFunction(pointType.update);
	},

	insertPointInfoDefs(point, id) {
		const $$ = this;
		const defs = $$.svg.select("defs");

		if (defs.size < 1) {
			return;
		}

		const html = defs.html();

		// Add the point node into <defs>
		defs.html(`${html}${point}`);

		const node = defs.node().lastChild;

		node.setAttribute("id", id);
		node.style.fill = "inherit";
		node.style.stroke = "none";
	},

	pointFromDefs(id) {
		const $$ = this;
		const defs = $$.svg.select("defs");

		return defs.select(`#${id}`);
	},

	generatePoint() {
		const $$ = this;
		const config = $$.config;
		const ids = [];
		const pattern = notEmpty(config.point_pattern) ? config.point_pattern : [config.point_type];

		return function(method, context, ...args) {
			return function(d) {
				const id = d.id || (d.data && d.data.id) || d;
				let point;

				if (ids.indexOf(id) < 0) {
					ids.push(id);
				}
				point = pattern[ids.indexOf(id) % pattern.length];

				if ($$.hasValidPointType(point)) {
					point = $$[point];
				} else if (!$$.hasValidPointDrawMethods(point)) {
					const pointId = `bb-point-${id}`;
					const pointFromDefs = $$.pointFromDefs(pointId);

					if (pointFromDefs.size() < 1) {
						$$.insertPointInfoDefs(point, pointId);
					}

					if (method === "create") {
						return $$.custom.create.bind(context)(d3Select(this), pointId, ...args);
					} else if (method === "update") {
						return $$.custom.update.bind(context)(d3Select(this), ...args);
					}
				}

				return point[method].bind(context)(d3Select(this), ...args);
			};
		};
	},

	getTransitionName() {
		return Math.random().toString();
	},

	custom: {
		create(element, id, cssClassFn, sizeFn, fillStyleFn) {
			return element.append("use")
				.attr("xlink:href", `#${id}`)
				.attr("class", cssClassFn)
				.style("fill", fillStyleFn)
				.node();
		},

		update(element, xPosFn, yPosFn, opacityStyleFn, fillStyleFn,
			withTransition, flow, selectedCircles) {
			const box = element.node().getBBox();
			const mainCircles = element
				.attr("x", d => xPosFn(d) - (box.width * 0.5))
				.attr("y", d => yPosFn(d) - (box.height * 0.5));

			return mainCircles
				.style("opacity", opacityStyleFn)
				.style("fill", fillStyleFn);
		}
	},

	// 'circle' data point
	circle: {
		create(element, cssClassFn, sizeFn, fillStyleFn) {
			return element.append("circle")
				.attr("class", cssClassFn)
				.attr("r", sizeFn)
				.style("fill", fillStyleFn)
				.node();
		},

		update(element, xPosFn, yPosFn, opacityStyleFn, fillStyleFn,
			withTransition, flow, selectedCircles) {
			const $$ = this;
			let mainCircles = element;

			// when '.load()' called, bubble size should be updated
			if ($$.hasType("bubble")) {
				mainCircles = mainCircles
					.attr("r", $$.pointR.bind($$));
			}

			if (withTransition) {
				const transitionName = $$.getTransitionName();

				if (flow) {
					mainCircles = mainCircles
						.attr("cx", xPosFn);
				}

				mainCircles = mainCircles
					.transition(transitionName)
					.attr("cx", xPosFn)
					.attr("cy", yPosFn)
					.transition(transitionName);

				selectedCircles.transition($$.getTransitionName());
			} else {
				mainCircles = mainCircles
					.attr("cx", xPosFn)
					.attr("cy", yPosFn);
			}

			return mainCircles
				.style("opacity", opacityStyleFn)
				.style("fill", fillStyleFn);
		}
	},

	// 'rectangle' data point
	rectangle: {
		create(element, cssClassFn, sizeFn, fillStyleFn) {
			const rectSizeFn = d => sizeFn(d) * 2.0;

			return element.append("rect")
				.attr("class", cssClassFn)
				.attr("width", rectSizeFn)
				.attr("height", rectSizeFn)
				.style("fill", fillStyleFn)
				.node();
		},

		update(element, xPosFn, yPosFn, opacityStyleFn, fillStyleFn,
			withTransition, flow, selectedCircles) {
			const $$ = this;
			const r = $$.config.point_r;
			const rectXPosFn = d => xPosFn(d) - r;
			const rectYPosFn = d => yPosFn(d) - r;

			let mainCircles = element;

			if (withTransition) {
				const transitionName = $$.getTransitionName();

				if (flow) {
					mainCircles = mainCircles
						.attr("x", rectXPosFn);
				}

				mainCircles = mainCircles
					.transition(transitionName)
					.attr("x", rectXPosFn)
					.attr("y", rectYPosFn)
					.transition(transitionName);

				selectedCircles.transition($$.getTransitionName());
			} else {
				mainCircles = mainCircles
					.attr("x", rectXPosFn)
					.attr("y", rectYPosFn);
			}

			return mainCircles
				.style("opacity", opacityStyleFn)
				.style("fill", fillStyleFn);
		}
	}
});
